import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
export function resolveCodexBinary(configured: string): string {
  if (configured && configured !== 'codex') return path.isAbsolute(configured) || configured.includes('/') || configured.includes('\\') ? path.resolve(configured) : configured;
  const triples: Record<string, string> = { 'win32-x64':'x86_64-pc-windows-msvc','win32-arm64':'aarch64-pc-windows-msvc','linux-x64':'x86_64-unknown-linux-musl','linux-arm64':'aarch64-unknown-linux-musl','darwin-x64':'x86_64-apple-darwin','darwin-arm64':'aarch64-apple-darwin' };
  const platform = process.platform + '-' + process.arch;
  try {
    const root = path.dirname(require.resolve('@openai/codex-' + platform + '/package.json'));
    const executable = process.platform === 'win32' ? 'codex.exe' : 'codex';
    for (const folder of ['bin','codex']) {
      const candidate = path.join(root,'vendor',triples[platform] ?? '',folder,executable);
      if (existsSync(candidate)) return candidate;
    }
  } catch { /* Fall back to a separately installed CLI on PATH. */ }
  return 'codex';
}
