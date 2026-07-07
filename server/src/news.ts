// Notícias que movem o mercado.
// Prioridade: CryptoPanic (se houver token, com voto da comunidade) →
// CryptoCompare (grátis, rico, muitas fontes) → RSS gratuito.

import { cached } from "./cache.js";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  currencies: string[];
  sentiment: "positivo" | "negativo" | "neutro";
}

const POS = /surge|rally|soar|bullish|gains?|breakout|approval|adopt|record|all-time high|ath|jump|rise|pump|inflow/i;
const NEG = /crash|plunge|hack|exploit|ban|lawsuit|sued|dump|bearish|sell-?off|liquidation|collapse|drop|fall|fear|outflow|fraud|scam/i;

function keywordSentiment(title: string): NewsItem["sentiment"] {
  const neg = NEG.test(title);
  const pos = POS.test(title);
  if (pos && !neg) return "positivo";
  if (neg && !pos) return "negativo";
  return "neutro";
}

async function fromCryptoPanic(token: string, currency?: string): Promise<NewsItem[]> {
  const url = new URL("https://cryptopanic.com/api/v1/posts/");
  url.searchParams.set("auth_token", token);
  url.searchParams.set("public", "true");
  if (currency) url.searchParams.set("currencies", currency);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CryptoPanic HTTP ${res.status}`);
  const data = await res.json();
  return (data.results || []).slice(0, 30).map((p: any): NewsItem => {
    const pos = p.votes?.positive ?? 0;
    const neg = p.votes?.negative ?? 0;
    return {
      title: p.title,
      url: p.url,
      source: p.source?.title || "CryptoPanic",
      publishedAt: p.published_at,
      currencies: (p.currencies || []).map((c: any) => c.code),
      sentiment: pos > neg + 1 ? "positivo" : neg > pos + 1 ? "negativo" : keywordSentiment(p.title),
    };
  });
}

async function fromCryptoCompare(currency?: string): Promise<NewsItem[]> {
  const url = new URL("https://min-api.cryptocompare.com/data/v2/news/");
  url.searchParams.set("lang", "EN");
  if (currency) url.searchParams.set("categories", currency);
  const key = process.env.CRYPTOCOMPARE_KEY;
  if (key) url.searchParams.set("api_key", key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CryptoCompare HTTP ${res.status}`);
  const data = await res.json();
  const rows: any[] = data?.Data || [];
  if (!rows.length) throw new Error("CryptoCompare vazio");
  return rows.slice(0, 30).map((a): NewsItem => ({
    title: a.title,
    url: a.url,
    source: a.source_info?.name || a.source || "CryptoCompare",
    publishedAt: new Date(a.published_on * 1000).toISOString(),
    currencies: (a.categories || "").split("|").filter((c: string) => /^[A-Z]{2,6}$/.test(c)).slice(0, 4),
    sentiment: keywordSentiment(a.title),
  }));
}

function parseRss(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const matches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const block of matches.slice(0, 15)) {
    const pick = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      if (!m) return "";
      return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, "").trim();
    };
    const title = pick("title");
    const link = pick("link") || (block.match(/<link[^>]*>([\s\S]*?)<\/link>/)?.[1] ?? "");
    if (!title) continue;
    items.push({
      title,
      url: link.trim(),
      source,
      publishedAt: pick("pubDate") || new Date().toISOString(),
      currencies: [],
      sentiment: keywordSentiment(title),
    });
  }
  return items;
}

async function fromRss(): Promise<NewsItem[]> {
  const feeds = [
    { url: "https://www.coindesk.com/arc/outboundfeeds/rss/", source: "CoinDesk" },
    { url: "https://cointelegraph.com/rss", source: "Cointelegraph" },
    { url: "https://decrypt.co/feed", source: "Decrypt" },
    { url: "https://bitcoinmagazine.com/.rss/full/", source: "Bitcoin Magazine" },
    { url: "https://cryptoslate.com/feed/", source: "CryptoSlate" },
  ];
  const all = await Promise.all(
    feeds.map(async (f) => {
      try {
        const res = await fetch(f.url);
        if (!res.ok) return [];
        return parseRss(await res.text(), f.source);
      } catch {
        return [];
      }
    })
  );
  return all.flat().sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()).slice(0, 30);
}

export function getNews(currency?: string): Promise<NewsItem[]> {
  return cached(`news:${currency || "global"}`, 300_000, async () => {
    const token = process.env.CRYPTOPANIC_TOKEN;
    if (token) {
      try {
        return await fromCryptoPanic(token, currency);
      } catch { /* segue */ }
    }
    try {
      return await fromCryptoCompare(currency);
    } catch { /* segue */ }
    return fromRss();
  });
}
