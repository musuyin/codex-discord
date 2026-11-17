import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { bootstrap } from 'global-agent';
const runtimePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '.local');
fs.mkdirSync(runtimePath, { recursive: true });
const identity = createHash('sha256').update(process.platform === 'win32' ? runtimePath.toLowerCase() : runtimePath).digest('hex').slice(0, 20);
const endpoint = process.platform === 'win32' ? '\\\\.\\pipe\\codex-discord-' + identity : path.join(runtimePath, 'bridge.sock');
// OS-owned IPC handles prevent PID-reuse false positives and are released on process exit.
const guard = net.createServer(socket => socket.end());
async function listen() {
  await new Promise((resolve, reject) => {
    const fail = error => { guard.off('listening', ready); reject(error); };
    const ready = () => { guard.off('error', fail); resolve(); };
    guard.once('error', fail); guard.once('listening', ready); guard.listen(endpoint);
  });
}
try { await listen(); }
catch (error) {
  if (error.code !== 'EADDRINUSE') throw error;
  if (process.platform === 'win32') throw new Error('Another codex-discord instance is already running.');
  const alive = await new Promise((resolve, reject) => {
    const probe = net.connect(endpoint);
    probe.once('connect', () => { probe.end(); resolve(true); });
    probe.once('error', cause => { if (['ECONNREFUSED', 'ENOENT'].includes(cause.code)) resolve(false); else reject(cause); });
  });
  if (alive) throw new Error('Another codex-discord instance is already running.');
  const relative = path.relative(runtimePath, endpoint);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Invalid IPC endpoint');
  try { fs.unlinkSync(endpoint); } catch (cause) { if (cause.code !== 'ENOENT') throw cause; }
  await listen();
}
guard.on('error', error => { console.error('Local instance guard failed:', error.message); process.exit(1); });
if (process.env.DISCORD_PROXY_URL) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.DISCORD_PROXY_URL;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.DISCORD_PROXY_URL;
  process.env.GLOBAL_AGENT_NO_PROXY = 'localhost,127.0.0.1';
  bootstrap();
}
await import('./dist/index.js');
