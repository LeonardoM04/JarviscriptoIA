import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Chart, { type Layers } from "./Chart";
import ScoreBadge from "./ScoreBadge";
import { fetchKlines, fetchStock } from "../api";
import type { ChatFocus } from "../api";
import type { KlinesResponse } from "../types";
import { changeClass, pct } from "../utils";

const LAYERS: Layers = {
  ema21: false, ema50: true, ema200: false, bollinger: false, volume: true, rsi: false, macd: false,
  patterns: false, trend: true, channel: false, halving: false,
};

const cycleColor: Record<string, string> = {
  alta: "#2ebd85", acumulação: "#22d3ee", distribuição: "#fbbf24", depressão: "#e04f5f",
};

// gráfico + dados que o Jarvis mostra quando você fala de uma moeda/ação
export default function FocusAsset({ focus }: { focus: ChatFocus }) {
  const [data, setData] = useState<KlinesResponse | null>(null);
  const [price, setPrice] = useState<{ value: number; changePct: number; currency: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    setData(null); setPrice(null); setError(false);
    let active = true;
    (async () => {
      try {
        if (focus.type === "acao") {
          const s = await fetchStock(focus.symbol, "D");
          if (!active) return;
          setData(s);
          setPrice({ value: s.quote.price, changePct: s.quote.changePct, currency: s.quote.currency });
        } else {
          const sym = focus.symbol + "USDT";
          const [k, t] = await Promise.all([fetchKlines(sym, "D", 200), fetchTickerSafe(sym)]);
          if (!active) return;
          setData(k);
          if (t) setPrice({ value: t.lastPrice, changePct: t.price24hPcnt, currency: "USD" });
        }
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; };
  }, [focus.symbol, focus.type]);

  const money = (v: number, cur: string) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur || "USD", maximumFractionDigits: v < 1 ? 6 : 2 }).format(v);
  const route = focus.type === "acao" ? `/acao/${focus.symbol}` : `/moeda/${focus.symbol}`;

  return (
    <div className="focus-asset">
      <div className="focus-head">
        <div className="focus-title">
          <b>{focus.symbol}</b> <span className="dim">{focus.name}</span>
          {data && <ScoreBadge score={data.score} showLabel={false} />}
          {data?.structures?.cycle && (
            <span className="cycle-badge sm" style={{ borderColor: cycleColor[data.structures.cycle.phase], color: cycleColor[data.structures.cycle.phase] }}>
              {data.structures.cycle.phase}
            </span>
          )}
        </div>
        {price && (
          <div className="focus-price">
            <b>{money(price.value, price.currency)}</b>
            <span className={changeClass(price.changePct)}>{pct(price.changePct)}</span>
          </div>
        )}
      </div>
      <div className="focus-chart">
        {error && <div className="dim" style={{ padding: 12 }}>Gráfico indisponível.</div>}
        {data && <Chart data={data} layers={LAYERS} />}
        {!data && !error && <div className="dim" style={{ padding: 12 }}>Carregando gráfico…</div>}
      </div>
      <Link to={route} className="focus-link">Abrir análise completa →</Link>
    </div>
  );
}

async function fetchTickerSafe(sym: string) {
  try {
    const { fetchTicker } = await import("../api");
    const t = await fetchTicker(sym);
    return t.ticker;
  } catch {
    return null;
  }
}
