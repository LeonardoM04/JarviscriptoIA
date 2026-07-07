import type { Candle } from "./bybit.js";
import type { MarketCoin } from "./coingecko.js";

const BINANCE_BASE = "https://api.binance.com";
const OKX_BASE = "https://www.okx.com";

const INTERVALS: Record<string, string> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1h",
  "120": "2h",
  "240": "4h",
  "360": "6h",
  "720": "12h",
  D: "1d",
  W: "1w",
};

const OKX_INTERVALS: Record<string, string> = {
  "1": "1m",
  "3": "3m",
  "5": "5m",
  "15": "15m",
  "30": "30m",
  "60": "1H",
  "120": "2H",
  "240": "4H",
  "360": "6H",
  "720": "12H",
  D: "1D",
  W: "1W",
};

const FALLBACK_COINS = [
  { id: "bitcoin", symbol: "btc", name: "Bitcoin", rank: 1, image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png", supply: 19_720_000 },
  { id: "ethereum", symbol: "eth", name: "Ethereum", rank: 2, image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png", supply: 120_200_000 },
  { id: "binancecoin", symbol: "bnb", name: "BNB", rank: 4, image: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png", supply: 145_900_000 },
  { id: "solana", symbol: "sol", name: "Solana", rank: 5, image: "https://assets.coingecko.com/coins/images/4128/large/solana.png", supply: 463_000_000 },
  { id: "ripple", symbol: "xrp", name: "XRP", rank: 6, image: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png", supply: 55_700_000_000 },
  { id: "dogecoin", symbol: "doge", name: "Dogecoin", rank: 8, image: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png", supply: 145_000_000_000 },
  { id: "cardano", symbol: "ada", name: "Cardano", rank: 10, image: "https://assets.coingecko.com/coins/images/975/large/cardano.png", supply: 35_600_000_000 },
  { id: "tron", symbol: "trx", name: "TRON", rank: 11, image: "https://assets.coingecko.com/coins/images/1094/large/tron-logo.png", supply: 87_000_000_000 },
  { id: "chainlink", symbol: "link", name: "Chainlink", rank: 15, image: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png", supply: 608_000_000 },
  { id: "avalanche-2", symbol: "avax", name: "Avalanche", rank: 16, image: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png", supply: 394_000_000 },
];

export async function getBinanceKlines(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  try {
    return await getBinanceKlinesOnly(symbol, interval, limit);
  } catch {
    return getOkxKlines(symbol, interval, limit);
  }
}

async function getBinanceKlinesOnly(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  const url = new URL(`${BINANCE_BASE}/api/v3/klines`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", INTERVALS[interval] ?? interval);
  url.searchParams.set("limit", String(Math.min(limit, 1000)));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const rows = (await res.json()) as unknown[][];
  return rows.map((r) => ({
    time: Math.floor(Number(r[0]) / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

export async function getBinanceTicker(symbol: string): Promise<{
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}> {
  try {
    return await getBinanceTickerOnly(symbol);
  } catch {
    return getOkxTicker(symbol);
  }
}

async function getBinanceTickerOnly(symbol: string): Promise<{
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}> {
  const url = new URL(`${BINANCE_BASE}/api/v3/ticker/24hr`);
  url.searchParams.set("symbol", symbol);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const t = await res.json();
  return {
    lastPrice: Number(t.lastPrice),
    price24hPcnt: Number(t.priceChangePercent),
    highPrice24h: Number(t.highPrice),
    lowPrice24h: Number(t.lowPrice),
    volume24h: Number(t.quoteVolume),
  };
}

async function getOkxKlines(symbol: string, interval: string, limit = 500): Promise<Candle[]> {
  const url = new URL(`${OKX_BASE}/api/v5/market/candles`);
  url.searchParams.set("instId", toOkxInstrument(symbol));
  url.searchParams.set("bar", OKX_INTERVALS[interval] ?? interval);
  url.searchParams.set("limit", String(Math.min(limit, 300)));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "0") throw new Error(`OKX: ${data.msg || "erro ao buscar candles"}`);
  const rows = (data.data ?? []) as string[][];
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

async function getOkxTicker(symbol: string): Promise<{
  lastPrice: number;
  price24hPcnt: number;
  highPrice24h: number;
  lowPrice24h: number;
  volume24h: number;
}> {
  const url = new URL(`${OKX_BASE}/api/v5/market/ticker`);
  url.searchParams.set("instId", toOkxInstrument(symbol));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OKX HTTP ${res.status}`);
  const data = await res.json();
  if (data.code !== "0" || !data.data?.length) throw new Error(`OKX: ${data.msg || "ticker indisponivel"}`);
  const t = data.data[0];
  const open24h = Number(t.open24h);
  const last = Number(t.last);
  return {
    lastPrice: last,
    price24hPcnt: open24h ? ((last - open24h) / open24h) * 100 : 0,
    highPrice24h: Number(t.high24h),
    lowPrice24h: Number(t.low24h),
    volume24h: Number(t.volCcy24h),
  };
}

function toOkxInstrument(symbol: string): string {
  return symbol.replace(/USDT$/, "-USDT");
}

export async function getBinanceFallbackMarkets(): Promise<MarketCoin[]> {
  const symbols = FALLBACK_COINS.map((c) => `${c.symbol.toUpperCase()}USDT`);
  const rows = await Promise.all(
    symbols.map((symbol) =>
      getBinanceTicker(symbol)
        .then((ticker) => ({ symbol, ticker }))
        .catch(() => null)
    )
  );

  return rows.flatMap((row, index) => {
    if (!row) return [];
    const meta = FALLBACK_COINS[index];
    const sparkline = Array.from({ length: 24 }, (_, i) => {
      const t = i / 23;
      const change = (row.ticker.price24hPcnt / 100) * (t - 1);
      return row.ticker.lastPrice * (1 + change);
    });
    return [{
      id: meta.id,
      symbol: meta.symbol,
      name: meta.name,
      image: meta.image,
      current_price: row.ticker.lastPrice,
      market_cap: row.ticker.lastPrice * meta.supply,
      market_cap_rank: meta.rank,
      total_volume: row.ticker.volume24h,
      price_change_percentage_1h: null,
      price_change_percentage_24h: row.ticker.price24hPcnt,
      price_change_percentage_7d: null,
      sparkline,
    }];
  });
}

export function fallbackSymbolToId(symbol: string): string | null {
  const base = symbol.replace(/USDT$/, "").toLowerCase();
  return FALLBACK_COINS.find((c) => c.symbol === base)?.id ?? null;
}
