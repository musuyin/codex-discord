import 'dotenv/config';
import { bootstrap } from 'global-agent';
import { configureProxy } from './dist/config/network.js';
import { fetch } from 'undici';
import WebSocket from 'ws';
const proxy = process.env.DISCORD_PROXY_URL;
if (proxy) {
process.env.GLOBAL_AGENT_HTTP_PROXY = proxy;
process.env.GLOBAL_AGENT_HTTPS_PROXY = proxy;
bootstrap();
}
configureProxy(proxy);
const result = await fetch('https://discord.com/api/v10/gateway', { signal: AbortSignal.timeout(15000) });
console.log('Discord HTTPS status:', result.status);
const gateway = await result.json();
await new Promise((resolve,reject) => {
  const socket = new WebSocket(gateway.url + '/?v=10&encoding=json');
  const timer = setTimeout(() => { socket.terminate(); reject(new Error('Gateway timeout')); },15000);
  socket.on('error', reject);
  socket.once('message', data => {
    const event = JSON.parse(data.toString());
    clearTimeout(timer);
    socket.close();
    if (event.op !== 10) reject(new Error('Unexpected Gateway message'));
    else { console.log('Discord Gateway HELLO received'); resolve(); }
  });
});
process.exit(0);
