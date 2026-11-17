import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fetch } from 'undici';

export interface ImageAttachment {
  url: string;
  name: string | null;
  contentType?: string | null;
  size: number;
}
export class ImageInputError extends Error {}
export interface ImageDownloader {
  download(channelId: string, messageId: string, attachments: readonly ImageAttachment[]): Promise<string[]>;
}
export interface ImageDownloadOptions {
  cacheRoot?: string;
  fetcher?: typeof fetch;
  maxImageBytes?: number;
  maxTotalBytes?: number;
}
const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp)$/i;
const CDN_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);
export class DiscordImageDownloader implements ImageDownloader {
  private readonly cacheRoot: string;
  private readonly fetcher: typeof fetch;
  private readonly maxImageBytes: number;
  private readonly maxTotalBytes: number;
  constructor(options: ImageDownloadOptions = {}) {
    this.cacheRoot = path.resolve(options.cacheRoot ?? '.local/inbound');
    this.fetcher = options.fetcher ?? fetch;
    this.maxImageBytes = options.maxImageBytes ?? 20 * 1024 * 1024;
    this.maxTotalBytes = options.maxTotalBytes ?? 40 * 1024 * 1024;
  }
  async download(channelId: string, messageId: string, attachments: readonly ImageAttachment[]): Promise<string[]> {
    if (!attachments.length) return [];
    if (!/^\d{17,20}$/.test(channelId) || !/^\d{17,20}$/.test(messageId)) throw new ImageInputError('图片消息标识无效，请重新上传。');
    if (attachments.length > 4) throw new ImageInputError('一次最多读取 4 张图片，请分开发送。');
    for (const attachment of attachments) {
      const url = new URL(attachment.url);
      if (url.protocol !== 'https:' || !CDN_HOSTS.has(url.hostname) || url.username || url.password || url.port) throw new ImageInputError('请直接上传图片到 Discord，不要使用外部图片地址。');
      if (!IMAGE_EXTENSIONS.test(attachment.name ?? '') && !/^image\/(png|jpeg|webp)$/i.test(attachment.contentType ?? '')) throw new ImageInputError('目前支持 PNG、JPG/JPEG 和 WebP 图片；请将其他格式转换后上传。');
      if (attachment.size > this.maxImageBytes) throw new ImageInputError('单张图片不能超过 20 MiB，请压缩后上传。');
    }
    await mkdir(this.cacheRoot, { recursive: true });
    const dir = await mkdtemp(path.join(this.cacheRoot, channelId + '-' + messageId + '-'));
    const paths: string[] = [];
    let total = 0;
    try {
      for (const attachment of attachments) {
        const response = await this.fetcher(attachment.url, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
        if (!response.ok || !response.body) throw new ImageInputError('图片下载失败或已过期，请重新上传。');
        const declared = Number(response.headers.get('content-length'));
        if (Number.isFinite(declared) && declared > this.maxImageBytes) {
          await response.body.cancel();
          throw new ImageInputError('图片文件过大，请压缩后上传。');
        }
        const chunks: Buffer[] = [];
        let bytes = 0;
        const reader = response.body.getReader();
        try {
          while (true) {
            const next = await reader.read();
            if (next.done) break;
            bytes += next.value.byteLength;
            total += next.value.byteLength;
            if (bytes > this.maxImageBytes || total > this.maxTotalBytes) {
              await reader.cancel();
              throw new ImageInputError('图片总大小超出限制，请压缩或分开发送。');
            }
            chunks.push(Buffer.from(next.value));
          }
        } finally { reader.releaseLock(); }
        const data = Buffer.concat(chunks);
        const extension = imageExtension(data);
        if (!extension) throw new ImageInputError('附件不是可读取的 PNG、JPEG 或 WebP 图片，请重新导出后上传。');
        const file = path.join(dir, 'image-' + (paths.length + 1) + extension);
        await writeFile(file, data, { flag: 'wx' });
        paths.push(file);
      }
      return paths;
    } catch (error) {
      const relative = path.relative(this.cacheRoot, path.resolve(dir));
      if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) await rm(dir, { recursive: true, force: true });
      if (error instanceof ImageInputError) throw error;
      throw new ImageInputError('图片下载失败，请检查网络后重新上传。');
    }
  }
}
function imageExtension(data: Buffer): string | null {
  if (data.length >= 8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return '.png';
  if (data.length >= 3 && data[0] === 255 && data[1] === 216 && data[2] === 255) return '.jpg';
  if (data.length >= 12 && data.toString('ascii',0,4) === 'RIFF' && data.toString('ascii',8,12) === 'WEBP') return '.webp';
  return null;
}
