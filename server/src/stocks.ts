// Mercado de ações (foco em computação quântica e IA) via Yahoo Finance —
// endpoint público v8/chart, sem chave. Cache + stale-on-error herdados.

import { cached } from "./cache.js";
import type { Candle } from "./bybit.js";

export interface StockGroup {
  id: string;
  label: string;
  tickers: { symbol: string; name: string }[];
}

export const STOCK_GROUPS: StockGroup[] = [
  {
    id: "quantica",
    label: "Computação Quântica",
    tickers: [
      { symbol: "IONQ", name: "IonQ" },
      { symbol: "RGTI", name: "Rigetti Computing" },
      { symbol: "QUBT", name: "Quantum Computing Inc" },
      { symbol: "QBTS", name: "D-Wave Quantum" },
      { symbol: "ARQQ", name: "Arqit Quantum" },
      { symbol: "LAES", name: "SEALSQ" },
    ],
  },
  {
    id: "ia",
    label: "Inteligência Artificial",
    tickers: [
      { symbol: "NVDA", name: "NVIDIA" },
      { symbol: "PLTR", name: "Palantir" },
      { symbol: "AMD", name: "AMD" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "GOOGL", name: "Alphabet" },
      { symbol: "META", name: "Meta Platforms" },
      { symbol: "TSM", name: "TSMC" },
      { symbol: "SMCI", name: "Super Micro" },
    ],
  },
  {
    id: "semicondutores",
    label: "Semicondutores",
    tickers: [
      { symbol: "AVGO", name: "Broadcom" },
      { symbol: "ARM", name: "Arm Holdings" },
      { symbol: "QCOM", name: "Qualcomm" },
      { symbol: "INTC", name: "Intel" },
      { symbol: "MU", name: "Micron" },
      { symbol: "ASML", name: "ASML" },
    ],
  },
  {
    id: "cripto-bolsa",
    label: "Cripto na Bolsa",
    tickers: [
      { symbol: "COIN", name: "Coinbase" },
      { symbol: "MSTR", name: "Strategy (MicroStrategy)" },
      { symbol: "HOOD", name: "Robinhood" },
      { symbol: "MARA", name: "MARA Holdings" },
      { symbol: "RIOT", name: "Riot Platforms" },
      { symbol: "CLSK", name: "CleanSpark" },
    ],
  },
  {
    id: "bigtech",
    label: "Big Tech & Crescimento",
    tickers: [
      { symbol: "AAPL", name: "Apple" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "NFLX", name: "Netflix" },
      { symbol: "ORCL", name: "Oracle" },
      { symbol: "CRM", name: "Salesforce" },
    ],
  },
];

const YF = "https://query1.finance.yahoo.com/v8/finance/chart";

// mapeia nossos intervalos para os do Yahoo (ação não tem 4h)
const YF_PARAMS: Record<string, { interval: string; range: string }> = {
  "60": { interval: "60m", range: "1mo" },
  D: { interval: "1d", range: "6mo" },
  W: { interval: "1wk", range: "2y" },
};

interface ChartResult {
  price: number;
  prevClose: number;
  changePct: number;
  currency: string;
  candles: Candle[];
}

async function fetchChart(symbol: string, interval: string, range: string): Promise<ChartResult> {
  const url = `${YF}/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
  if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
  const data = await res.json();
  const r = data?.chart?.result?.[0];
  if (!r) throw new Error("Yahoo: sem dados");
  const ts: number[] = r.timestamp ?? [];
  const q = r.indicators?.quote?.[0] ?? {};
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null || q.open?.[i] == null) continue;
    candles.push({
      time: ts[i],
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    });
  }
  const price = r.meta?.regularMarketPrice ?? candles[candles.length - 1]?.close ?? 0;
  // variação calculada pela diferença dos dois últimos fechamentos das velas
  // (os campos meta.previousClose do Yahoo variam conforme o range — não confiáveis).
  const prevClose = candles.length >= 2 ? candles[candles.length - 2].close : (r.meta?.previousClose ?? price);
  return {
    price,
    prevClose,
    changePct: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    currency: r.meta?.currency ?? "USD",
    candles,
  };
}

export function getStockChart(symbol: string, interval = "D"): Promise<ChartResult> {
  const p = YF_PARAMS[interval] ?? YF_PARAMS.D;
  return cached(`stock:${symbol}:${interval}`, 60_000, () => fetchChart(symbol.toUpperCase(), p.interval, p.range));
}

export interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  currency: string;
  sparkline: number[];
}

// Notícias da ação via busca do Yahoo Finance (keyless)
export interface StockNews {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
}

export function getStockNews(symbol: string): Promise<StockNews[]> {
  return cached(`stocknews:${symbol}`, 300_000, async () => {
    const url = new URL("https://query1.finance.yahoo.com/v1/finance/search");
    url.searchParams.set("q", symbol.toUpperCase());
    url.searchParams.set("newsCount", "10");
    url.searchParams.set("quotesCount", "0");
    const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0", accept: "application/json" } });
    if (!res.ok) throw new Error(`Yahoo HTTP ${res.status}`);
    const data = await res.json();
    return (data?.news ?? []).map((n: any): StockNews => ({
      title: n.title,
      url: n.link,
      source: n.publisher || "Yahoo Finance",
      publishedAt: n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toISOString() : new Date().toISOString(),
    }));
  });
}

export function getStockGroups(): Promise<{ id: string; label: string; stocks: StockQuote[] }[]> {
  return cached("stock:groups", 60_000, async () => {
    return Promise.all(
      STOCK_GROUPS.map(async (g) => {
        const stocks = await Promise.all(
          g.tickers.map(async (t) => {
            try {
              const c = await fetchChart(t.symbol, "1d", "1mo");
              return {
                symbol: t.symbol,
                name: t.name,
                price: c.price,
                changePct: c.changePct,
                currency: c.currency,
                sparkline: c.candles.map((k) => k.close),
              } as StockQuote;
            } catch {
              return null;
            }
          })
        );
        return { id: g.id, label: g.label, stocks: stocks.filter((s): s is StockQuote => s !== null) };
      })
    );
  });
}
