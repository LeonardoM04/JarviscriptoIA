// Coleta de dados da API pública da Bybit (spot, sem autenticação)

export interface Candle {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

import { cached } from "./cache.js";
import { getBinanceKlines, getBinanceTicker } from "./binance.js";
import { getCoinGeckoKlines } from "./coingecko.js";

const BASE = "https://api.bybit.com";

export async function getKlines(
  symbol: string,
  interval: string,
  limit = 500
): Promise<Candle[]> {
  return cached(`klines:${symbol}:${interval}:${limit}`, 30_000, async () => {
    try {
      return await getBybitKlines(symbol, interval, limit);
    } catch {
      try {
        return await getBinanceKlines(symbol, interval, limit);
      } catch {
        // último recurso: candles da CoinGecko (cobre moedas fora das corretoras)
        return getCoinGeckoKlines(symbol, interval);
      }
    }
  });
}

async function getBybitKlines(
  symbol: string,
  interval: string,
  limit = 500
): Promise<Candle[]> {
  const url = new URL(`${BASE}/v5/market/kline`);
  url.searchParams.set("category", "spot");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
  const data = await res.json();
  if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`);

  // Bybit retorna do mais recente para o mais antigo — invertemos
  const rows: string[][] = data.result.list;
  return rows
    .map((r) => ({
      time: Math.floor(Number(r[0]) / 1000),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
      volume: Number(r[5]),
    }))
    .reverse();
}

export async function getTicker(symbol: string): Promise<{
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}> {
  return cached(`ticker:${symbol}`, 30_000, async () => {
    try {
      return await getBybitTicker(symbol);
    } catch {
      return getBinanceTicker(symbol);
    }
  });
}

async function getBybitTicker(symbol: string): Promise<{
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}> {
  const url = new URL(`${BASE}/v5/market/tickers`);
  url.searchParams.set("category", "spot");
  url.searchParams.set("symbol", symbol);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Bybit HTTP ${res.status}`);
  const data = await res.json();
  if (data.retCode !== 0 || !data.result.list?.length) {
    throw new Error(`Bybit: ${data.retMsg || "símbolo não encontrado"}`);
  }
  const t = data.result.list[0];
  return {
    lastPrice: Number(t.lastPrice),
    price24hPcnt: Number(t.price24hPcnt) * 100,
    highPrice24h: Number(t.highPrice24h),
    lowPrice24h: Number(t.lowPrice24h),
    volume24h: Number(t.volume24h),
  };
}

// Índice de Medo e Ganância (alternative.me) — contexto de sentimento do mercado
export async function getFearGreed(): Promise<{ value: number; label: string } | null> {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=1");
    if (!res.ok) return null;
    const data = await res.json();
    const item = data?.data?.[0];
    if (!item) return null;
    return { value: Number(item.value), label: item.value_classification };
  } catch {
    return null;
  }
}
