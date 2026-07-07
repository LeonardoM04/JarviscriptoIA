// Cache em memória com TTL + resiliência: se a atualização falhar (ex.: 429 da
// CoinGecko), servimos o último valor conhecido em vez de quebrar a tela.

interface Entry<T> {
  value: T;
  expires: number;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const value = await fn();
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    // stale-while-error: melhor um dado um pouco velho do que um erro na cara
    if (hit) return hit.value;
    throw err;
  }
}
