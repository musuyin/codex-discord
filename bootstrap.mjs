import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import { bootstrap } from 'global-agent';
const runtimePath=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'.local');
fs.mkdirSync(runtimePath,{recursive:true});
const lockPath=path.join(runtimePath,'bridge.lock');
let lock;
try { lock=fs.openSync(lockPath,'wx'); }
catch(error) {
  if(error.code!=='EEXIST')throw error;
  const owner=Number(fs.readFileSync(lockPath,'utf8').trim());
  if(!Number.isSafeInteger(owner)||owner<=0)throw new Error('Bridge lock is invalid; inspect it locally before starting.');
  let running=true;
  try { process.kill(owner,0); } catch(probe) { if(probe.code==='ESRCH')running=false; else throw probe; }
  if(running)throw new Error('Another bridge instance is already running.');
  fs.unlinkSync(lockPath);
  lock=fs.openSync(lockPath,'wx');
}
fs.writeFileSync(lock,String(process.pid));
fs.closeSync(lock);
process.once('exit',()=>{
  try { if(fs.readFileSync(lockPath,'utf8').trim()===String(process.pid))fs.unlinkSync(lockPath); } catch {}
});
if (process.env.DISCORD_PROXY_URL) {
  process.env.GLOBAL_AGENT_HTTP_PROXY = process.env.DISCORD_PROXY_URL;
  process.env.GLOBAL_AGENT_HTTPS_PROXY = process.env.DISCORD_PROXY_URL;
  process.env.GLOBAL_AGENT_NO_PROXY = 'localhost,127.0.0.1';
  bootstrap();
}
await import('./dist/index.js');