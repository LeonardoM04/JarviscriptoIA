// CoinGecko (API pública gratuita, sem chave) — universo de moedas,
// dominância do mercado e fundamentos por moeda.

import Anthropic from "@anthropic-ai/sdk";
import { cached } from "./cache.js";
import { fallbackSymbolToId, getBinanceFallbackMarkets } from "./binance.js";

// tradução curta pt-BR via Haiku (rápido/barato); silenciosamente mantém o original se falhar
async function translateToPt(text: string): Promise<string> {
  if (!text || !process.env.ANTHROPIC_API_KEY) return text;
  try {
    const client = new Anthropic();
    const r = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      system: "Traduza o texto para português do Brasil. Responda APENAS com a tradução, sem aspas nem comentários.",
      messages: [{ role: "user", content: text }],
    });
    const t = r.content.find((b) => b.type === "text");
    return t && t.type === "text" ? t.text.trim() : text;
  } catch {
    return text;
  }
}

const BASE = "https://api.coingecko.com/api/v3";

// Chave Demo grátis da CoinGecko (autentica por chave, evita o bloqueio por IP
// compartilhado do Render). Sem ela, cai no limite público (sujeito a 429).
const CG_KEY = process.env.COINGECKO_KEY;
const cgHeaders = (): Record<string, string> => {
  const h: Record<string, string> = { accept: "application/json" };
  if (CG_KEY) h["x-cg-demo-api-key"] = CG_KEY;
  return h;
};

// traduz as tags de categoria mais comuns da CoinGecko (elas só vêm em inglês)
const CATEGORY_PT: Record<string, string> = {
  "artificial intelligence (ai)": "Inteligência Artificial (IA)",
  "ai agents": "Agentes de IA",
  "ai applications": "Aplicações de IA",
  "meme": "Meme",
  "gaming (gamefi)": "Games (GameFi)",
  "decentralized finance (defi)": "Finanças Descentralizadas (DeFi)",
  "smart contract platform": "Plataforma de Contratos Inteligentes",
  "layer 1 (l1)": "Camada 1 (L1)",
  "layer 2 (l2)": "Camada 2 (L2)",
  "stablecoins": "Stablecoins",
  "exchange-based tokens": "Tokens de Corretora",
  "real world assets (rwa)": "Ativos do Mundo Real (RWA)",
  "privacy coins": "Moedas de Privacidade",
  "storage": "Armazenamento",
  "oracle": "Oráculo",
  "base ecosystem": "Ecossistema Base",
  "solana ecosystem": "Ecossistema Solana",
  "ethereum ecosystem": "Ecossistema Ethereum",
  "binance alpha spotlight": "Destaque Binance Alpha",
};
const translateCategory = (c: string): string => CATEGORY_PT[c.toLowerCase()] ?? c;

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

export async function getMarkets(perPage = 100, page = 1): Promise<MarketCoin[]> {
  try {
    // cached() já serve o último resultado REAL em cache se a CoinGecko falhar
    // (stale-on-error). Por isso o fetch lança em vez de cair pro fallback aqui.
    return await cached(`markets:${perPage}:${page}`, 180_000, async () => {
      const url = new URL(`${BASE}/coins/markets`);
      url.searchParams.set("vs_currency", "usd");
      url.searchParams.set("order", "market_cap_desc");
      url.searchParams.set("per_page", String(perPage));
      url.searchParams.set("page", String(page));
      url.searchParams.set("sparkline", "true");
      url.searchParams.set("price_change_percentage", "1h,24h,7d");

      const res = await fetch(url, { headers: cgHeaders() });
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
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
  } catch {
    // Nem CoinGecko nem cache disponíveis (ex.: 1º acesso a frio durante 429):
    // último recurso é a lista reduzida via Binance.
    return getBinanceFallbackMarkets();
  }
}

export interface GlobalData {
  totalMarketCapUsd: number;
  marketCapChange24h: number;
  btcDominance: number;
  ethDominance: number;
}

export async function getGlobal(): Promise<GlobalData> {
  try {
    return await cached("global", 180_000, async () => {
      const res = await fetch(`${BASE}/global`, { headers: cgHeaders() });
      if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
      const { data } = await res.json();
      return {
        totalMarketCapUsd: data.total_market_cap.usd,
        marketCapChange24h: data.market_cap_change_percentage_24h_usd,
        btcDominance: data.market_cap_percentage.btc,
        ethDominance: data.market_cap_percentage.eth,
      };
    });
  } catch {
    // último recurso: estima a partir da lista reduzida da Binance
    const markets = await getBinanceFallbackMarkets();
    const total = markets.reduce((sum, m) => sum + m.market_cap, 0);
    if (total <= 0) throw new Error("Dados de mercado indisponíveis");
    const btc = markets.find((m) => m.symbol === "btc")?.market_cap ?? 0;
    const eth = markets.find((m) => m.symbol === "eth")?.market_cap ?? 0;
    return {
      totalMarketCapUsd: total,
      marketCapChange24h:
        markets.reduce((sum, m) => sum + m.market_cap * (m.price_change_percentage_24h ?? 0), 0) / total,
      btcDominance: (btc / total) * 100,
      ethDominance: (eth / total) * 100,
    };
  }
}

// Candles via CoinGecko (OHLC) — último recurso para moedas fora das corretoras.
// Granularidade é automática pela CoinGecko (não bate exatamente com o intervalo).
const OHLC_DAYS: Record<string, number> = { "15": 1, "60": 7, "240": 30, D: 180, W: 365 };

export async function getCoinGeckoKlines(
  symbol: string,
  interval: string
): Promise<{ time: number; open: number; high: number; low: number; close: number; volume: number }[]> {
  const id = await symbolToId(symbol);
  if (!id) throw new Error("Moeda não encontrada na CoinGecko");
  const days = OHLC_DAYS[interval] ?? 90;
  return cached(`cgohlc:${id}:${days}`, 120_000, async () => {
    const url = new URL(`${BASE}/coins/${id}/ohlc`);
    url.searchParams.set("vs_currency", "usd");
    url.searchParams.set("days", String(days));
    const res = await fetch(url, { headers: cgHeaders() });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const rows: number[][] = await res.json();
    return rows.map((r) => ({
      time: Math.floor(r[0] / 1000),
      open: r[1], high: r[2], low: r[3], close: r[4], volume: 0,
    }));
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
    url.searchParams.set("localization", "true"); // traz descrição em vários idiomas
    url.searchParams.set("tickers", "false");
    url.searchParams.set("market_data", "true");
    url.searchParams.set("community_data", "false");
    url.searchParams.set("developer_data", "false");
    const res = await fetch(url, { headers: cgHeaders() });
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
    const d = await res.json();
    // CoinGecko raramente tem descrição em PT; traduzimos o inglês com o Haiku
    const ptDesc: string = d.description?.pt?.trim() || "";
    const rawDesc: string = (ptDesc || d.description?.en || "").split(". ").slice(0, 3).join(". ");
    const description = ptDesc ? rawDesc : await translateToPt(rawDesc);
    return {
      id: d.id,
      name: d.name,
      symbol: d.symbol,
      description,
      categories: (d.categories || []).filter(Boolean).slice(0, 5).map(translateCategory),
      marketCapRank: d.market_cap_rank ?? null,
      athChangePct: d.market_data?.ath_change_percentage?.usd ?? null,
      atlChangePct: d.market_data?.atl_change_percentage?.usd ?? null,
      circulatingSupply: d.market_data?.circulating_supply ?? null,
      maxSupply: d.market_data?.max_supply ?? null,
      homepage: d.links?.homepage?.[0] || null,
    };
  });
}
