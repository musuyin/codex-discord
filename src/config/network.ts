import { ProxyAgent, setGlobalDispatcher } from 'undici';

export function configureProxy(proxy: string | undefined): void {
  if (!proxy) return;
  const url = new URL(proxy);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('HTTP proxy URL required');
  const proxyEnv = { HTTP_PROXY: proxy, HTTPS_PROXY: proxy, NO_PROXY: 'localhost,127.0.0.1,::1' };
  Object.assign(process.env, proxyEnv);
  // REST uses undici. bootstrap.mjs configures the Gateway HTTP CONNECT agent.
  setGlobalDispatcher(new ProxyAgent(proxy));
}
