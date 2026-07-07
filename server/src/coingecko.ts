// CoinGecko (API pública gratuita, sem chave) — universo de moedas,
// dominância do mercado e fundamentos por moeda.

import { cached } from "./cache.js";
import { fallbackSymbolToId, getBinanceFallbackMarkets } from "./binance.js";

const BASE = "https://api.coingecko.com/api/v3";

// Chave Demo grátis da CoinGecko (autentica por chave, evita o bloqueio por IP
// compartilhado do Render). Sem ela, cai no limite público (sujeito a 429).
const CG_KEY = process.env.COINGECKO_KEY;
const cgHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { accept: "application/json" };
  if (CG_KEY) h["x-cg-demo-api-key"] = CG_KEY;
  return h;
};

export interface MarketCoin {
  id: string;
  symbol: string; // "btc"
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_1h: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d: number | null;
  sparkline: number[];
}

interface RawMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_1h_in_currency: number | null;
  price_change_percentage_24h_in_currency: number | null;
  price_change_percentage_7d_in_currency: number | null;
  sparkline_in_7d?: { price: number[] };
}

export function getMarkets(perPage = 100, page = 1): Promise<MarketCoin[]> {
  return cached(`markets:${perPage}:${page}`, 180_000, async () => {
    const url = new URL(`${BASE}/coins/markets`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("order", "market_cap_desc");
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("sparkline", "true");
    url.searchParams.set("price_change_percentage", "1h,24h,7d");

    const res = await fetch(url, { headers: cgHeaders() });
    if (!res.ok) {
      const fallback = await getBinanceFallbackMarkets();
      if (fallback.length) return fallback;
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    const rows: RawMarket[] = await res.json();
    return rows.map((r) => ({
      id: r.id,
      symbol: r.symbol,
      name: r.name,
      image: r.image,
      current_price: r.current_price,
      market_cap: r.market_cap,
      market_cap_rank: r.market_cap_rank,
      total_volume: r.total_volume,
      price_change_percentage_1h: r.price_change_percentage_1h_in_currency,
      price_change_percentage_24h: r.price_change_percentage_24h_in_currency,
      price_change_percentage_7d: r.price_change_percentage_7d_in_currency,
      sparkline: r.sparkline_in_7d?.price ?? [],
    }));
  });
}

export interface GlobalData {
  totalMarketCapUsd: number;
  marketCapChange24h: number;
  btcDominance: number;
  ethDominance: number;
}

export function getGlobal(): Promise<GlobalData> {
  return cached("global", 180_000, async () => {
    const res = await fetch(`${BASE}/global`, { headers: cgHeaders() });
    if (!res.ok) {
      const markets = await getBinanceFallbackMarkets();
      const total = markets.reduce((sum, m) => sum + m.market_cap, 0);
      const btc = markets.find((m) => m.symbol === "btc")?.market_cap ?? 0;
      const eth = markets.find((m) => m.symbol === "eth")?.market_cap ?? 0;
      const marketCapChange24h = total
        ? markets.reduce((sum, m) => sum + m.market_cap * (m.price_change_percentage_24h ?? 0), 0) / total
        : 0;
      if (total > 0) {
        return {
          totalMarketCapUsd: total,
          marketCapChange24h,
          btcDominance: (btc / total) * 100,
          ethDominance: (eth / total) * 100,
        };
      }
      throw new Error(`CoinGecko HTTP ${res.status}`);
    }
    const { data } = await res.json();
    return {
      totalMarketCapUsd: data.total_market_cap.usd,
      marketCapChange24h: data.market_cap_change_percentage_24h_usd,
      btcDominance: data.market_cap_percentage.btc,
      ethDominance: data.market_cap_percentage.eth,
    };
  });
}

// Mapa símbolo-Bybit (BTCUSDT) -> id CoinGecko (bitcoin), a partir do top de mercado.
export async function symbolToId(symbol: string): Promise<string | null> {
  const base = symbol.replace(/USDT$/, "").toLowerCase();
  const markets = await getMarkets(250, 1);
  const match = markets.find((m) => m.symbol.toLowerCase() === base);
  return match?.id ?? fallbackSymbolToId(symbol);
}

export interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  description: string;
  categories: string[];
  marketCapRank: number | null;
  athChangePct: number | null;
  atlChangePct: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  homepage: string | null;
}

export function getCoinDetail(id: string): Promise<CoinDetail> {
  return cached(`coin:${id}`, 300_000, async () => {
    const url = new URL(`${BASE}/coins/${id}`);
    url.searchParams.set("localization", "false");
    url.searchParams.set("tickers", "false");
    url.searchParams.set("market_data", "true");
    url.searchParams.set("community_data", "false");
    url.searchParams.set("developer_data", "false");
    const res = await fetch(url, { headers: cgHeaders() });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const d = await res.json();
    const desc: string = d.description?.en || "";
    return {
      id: d.id,
      name: d.name,
      symbol: d.symbol,
      description: desc.split(". ").slice(0, 3).join(". "),
      categories: (d.categories || []).filter(Boolean).slice(0, 5),
      marketCapRank: d.market_cap_rank ?? null,
      athChangePct: d.market_data?.ath_change_percentage?.usd ?? null,
      atlChangePct: d.market_data?.atl_change_percentage?.usd ?? null,
      circulatingSupply: d.market_data?.circulating_supply ?? null,
      maxSupply: d.market_data?.max_supply ?? null,
      homepage: d.links?.homepage?.[0] || null,
    };
  });
}
