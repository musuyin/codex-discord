import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Response, type fetch } from 'undici';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscordImageDownloader } from '../src/bot/image-attachments.js';
const dirs: string[] = [];
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aG1cAAAAASUVORK5CYII=', 'base64');
const attachment = {url:'https://cdn.discordapp.com/attachments/123/test.png?ex=opaque',name:'../../test.png',contentType:'image/png',size:png.length};
const channel='123456789012345678',message='223456789012345678';
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
async function root(){const dir=await mkdtemp(path.join(tmpdir(),'discord-images-test-'));dirs.push(dir);return dir;}
describe('Discord image download boundary',()=>{
 it('saves an actual PNG with a generated safe filename and ignores user filename traversal',async()=>{
  const cacheRoot=await root();
  const fetcher=vi.fn<typeof fetch>(async()=>new Response(png));
  const paths=await new DiscordImageDownloader({cacheRoot,fetcher}).download(channel,message,[attachment]);
  expect(paths).toHaveLength(1);expect(path.basename(paths[0]!)).toBe('image-1.png');
  expect(path.relative(cacheRoot,paths[0]!).startsWith('..')).toBe(false);
  expect(await readFile(paths[0]!)).toEqual(png);
  expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
 });
 it('rejects non-Discord hosts before fetching',async()=>{
  const fetcher=vi.fn<typeof fetch>();
  await expect(new DiscordImageDownloader({cacheRoot:await root(),fetcher}).download(channel,message,[{...attachment,url:'https://cdn.discordapp.com.evil.invalid/photo.png'}])).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
 });
 it('rejects unsupported image formats and more than four images',async()=>{
  const fetcher=vi.fn<typeof fetch>();const downloader=new DiscordImageDownloader({cacheRoot:await root(),fetcher});
  await expect(downloader.download(channel,message,[{...attachment,name:'photo.heic',contentType:'image/heic'}])).rejects.toThrow('PNG');
  await expect(downloader.download(channel,message,Array(5).fill(attachment))).rejects.toThrow('4');expect(fetcher).not.toHaveBeenCalled();
 });
 it('enforces actual streamed size and cleans an incomplete download',async()=>{
  const cacheRoot=await root();const fetcher=vi.fn<typeof fetch>(async()=>new Response(png));
  const downloader=new DiscordImageDownloader({cacheRoot,fetcher,maxImageBytes:20});
  await expect(downloader.download(channel,message,[{...attachment,size:1}])).rejects.toThrow('限制');
  expect(await readdir(cacheRoot)).toEqual([]);
 });
 it('rejects a disguised non-image and cleans its cache directory',async()=>{
  const cacheRoot=await root();const fetcher=vi.fn<typeof fetch>(async()=>new Response('<svg>not a PNG</svg>'));
  await expect(new DiscordImageDownloader({cacheRoot,fetcher}).download(channel,message,[attachment])).rejects.toThrow('附件不是');
  expect(await readdir(cacheRoot)).toEqual([]);
 });
 it('handles a stale attachment without retaining partial files',async()=>{
  const cacheRoot=await root();const fetcher=vi.fn<typeof fetch>(async()=>new Response('',{status:404}));
  await expect(new DiscordImageDownloader({cacheRoot,fetcher}).download(channel,message,[attachment])).rejects.toThrow('重新上传');
  expect(await readdir(cacheRoot)).toEqual([]);
 });
 it('accepts text-only input without downloading anything',async()=>{
  const fetcher=vi.fn<typeof fetch>();expect(await new DiscordImageDownloader({fetcher}).download(channel,message,[])).toEqual([]);expect(fetcher).not.toHaveBeenCalled();
 });
});
