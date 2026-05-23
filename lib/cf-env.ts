import type { KVNamespace } from '@cloudflare/workers-types';

interface Eez4usEnv {
  CACHE?: KVNamespace;
}

export async function getEez4usEnv(): Promise<Eez4usEnv> {
  try {
    const mod = await import('@opennextjs/cloudflare');
    const ctx = await mod.getCloudflareContext({ async: true });
    return ctx.env as unknown as Eez4usEnv;
  } catch {
    return {};
  }
}

export async function getCacheKV(): Promise<KVNamespace | null> {
  const env = await getEez4usEnv();
  return env.CACHE ?? null;
}
