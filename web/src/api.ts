import type {
  AnalyzeResponse,
  CoinDetail,
  Derivatives,
  FearGreed,
  GlobalData,
  KlinesResponse,
  MarketCoin,
  NewsItem,
  Ticker,
} from "./types";
import { authHeaders, onAuthFail } from "./auth";

async function req(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (res.status === 401) {
    onAuthFail();
    throw new Error("Sessão expirada — entre com a senha novamente.");
  }
  return res;
}

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Erro HTTP ${res.status}`);
  return data as T;
}

// valida a senha contra o servidor
export async function checkAuth(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth", { headers: authHeaders() });
    return res.ok;
  } catch {
    return false;
  }
}

export function fetchKlines(symbol: string, interval: string, limit = 500) {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  return req(`/api/klines?${params}`).then((r) => handle<KlinesResponse>(r));
}

export function fetchTicker(symbol: string) {
  const params = new URLSearchParams({ symbol });
  return req(`/api/ticker?${params}`).then((r) =>
    handle<{ symbol: string; ticker: Ticker; fearGreed: FearGreed | null; derivatives: Derivatives }>(r)
  );
}

export function fetchMarkets() {
  return req(`/api/markets`).then((r) => handle<{ markets: MarketCoin[] }>(r));
}

export function fetchGlobal() {
  return req(`/api/global`).then((r) => handle<{ global: GlobalData; fearGreed: FearGreed | null }>(r));
}

export function fetchCoin(symbol: string) {
  return req(`/api/coin/${symbol}`).then((r) =>
    handle<{ symbol: string; detail: CoinDetail | null; news: NewsItem[]; derivatives: Derivatives }>(r)
  );
}

export function fetchNews(symbol?: string) {
  const q = symbol ? `?symbol=${symbol}` : "";
  return req(`/api/news${q}`).then((r) => handle<{ news: NewsItem[] }>(r));
}

export function fetchStocks() {
  return req(`/api/stocks`).then((r) => handle<{ groups: import("./types").StockGroupData[] }>(r));
}

export function fetchStock(symbol: string, interval: string) {
  const params = new URLSearchParams({ interval });
  return req(`/api/stock/${symbol}?${params}`).then((r) => handle<import("./types").StockDetail>(r));
}

export function requestAnalysis(symbol: string, chartImage?: string) {
  return req(`/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, chartImage }),
  }).then((r) => handle<AnalyzeResponse>(r));
}

export interface ChatFocus { symbol: string; type: "cripto" | "acao"; name: string; }

// hora local do usuário vai na query — o servidor (UTC) usa pra saudar certo
export function fetchBriefing() {
  return req(`/api/briefing?hour=${new Date().getHours()}`).then((r) => handle<{ briefing: string }>(r));
}

export function sendChat(messages: { role: "user" | "assistant"; content: string }[]) {
  return req(`/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  }).then((r) => handle<{ reply: string; focus: ChatFocus | null }>(r));
}

export function requestStockAnalysis(symbol: string, chartImage?: string) {
  return req(`/api/analyze-stock`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, chartImage }),
  }).then((r) => handle<AnalyzeResponse>(r));
}
