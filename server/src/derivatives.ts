// Dados de derivativos (perpétuos lineares) da Bybit — sentimento e
// posicionamento dos grandes players, que o mercado spot não mostra:
// funding rate, open interest e a proporção long/short das contas.

import { cached } from "./cache.js";

const BASE = "https://api.bybit.com";

export interface Derivatives {
  available: boolean;
  fundingRate: number | null; // % (positivo = longs pagam shorts = viés otimista esticado)
  openInterest: number | null;
  openInterestValueUsd: number | null;
  oiTrend: "subindo" | "caindo" | "estável" | null;
  buyRatio: number | null; // 0-1 (fração de contas compradas)
  sellRatio: number | null; // 0-1 (fração de contas vendidas)
}

async function accountRatio(symbol: string): Promise<{ buy: number | null; sell: number | null }> {
  try {
    const url = new URL(`${BASE}/v5/market/account-ratio`);
    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("period", "1h");
    url.searchParams.set("limit", "1");
    const res = await fetch(url);
    const data = await res.json();
    const r = data?.result?.list?.[0];
    if (!r) return { buy: null, sell: null };
    return { buy: Number(r.buyRatio), sell: Number(r.sellRatio) };
  } catch {
    return { buy: null, sell: null };
  }
}

async function oiTrend(symbol: string): Promise<Derivatives["oiTrend"]> {
  try {
    const url = new URL(`${BASE}/v5/market/open-interest`);
    url.searchParams.set("category", "linear");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("intervalTime", "1h");
    url.searchParams.set("limit", "24");
    const res = await fetch(url);
    const data = await res.json();
    const list: { openInterest: string }[] = data?.result?.list || [];
    if (list.length < 2) return null;
    const recent = Number(list[0].openInterest);
    const older = Number(list[list.length - 1].openInterest);
    const delta = (recent - older) / older;
    return delta > 0.03 ? "subindo" : delta < -0.03 ? "caindo" : "estável";
  } catch {
    return null;
  }
}

export function getDerivatives(symbol: string): Promise<Derivatives> {
  return cached(`deriv:${symbol}`, 60_000, async () => {
    const empty: Derivatives = {
      available: false, fundingRate: null, openInterest: null,
      openInterestValueUsd: null, oiTrend: null, buyRatio: null, sellRatio: null,
    };
    try {
      const tUrl = new URL(`${BASE}/v5/market/tickers`);
      tUrl.searchParams.set("category", "linear");
      tUrl.searchParams.set("symbol", symbol);
      const [tRes, ratio, trend] = await Promise.all([fetch(tUrl), accountRatio(symbol), oiTrend(symbol)]);
      const t = (await tRes.json())?.result?.list?.[0];
      if (!t) return empty;

      return {
        available: true,
        fundingRate: t.fundingRate != null ? Number(t.fundingRate) * 100 : null,
        openInterest: t.openInterest != null ? Number(t.openInterest) : null,
        openInterestValueUsd: t.openInterestValue != null ? Number(t.openInterestValue) : null,
        oiTrend: trend,
        buyRatio: ratio.buy,
        sellRatio: ratio.sell,
      };
    } catch {
      return empty;
    }
  });
}
