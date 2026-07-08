import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Chart, { type Layers } from "../components/Chart";
import ScoreBadge from "../components/ScoreBadge";
import { fetchStock } from "../api";
import type { StockDetail } from "../types";
import { changeClass, pct } from "../utils";

const INTERVALS = [
  { value: "60", label: "1h" },
  { value: "D", label: "1D" },
  { value: "W", label: "1S" },
];

const DEFAULT_LAYERS: Layers = {
  ema21: false, ema50: true, ema200: false, bollinger: false, volume: true, rsi: false, macd: false,
  patterns: false, trend: false, channel: false, halving: false,
};

const LAYER_LABELS: { key: keyof Layers; label: string }[] = [
  { key: "ema21", label: "EMA 21" }, { key: "ema50", label: "EMA 50" }, { key: "ema200", label: "EMA 200" },
  { key: "bollinger", label: "Bollinger" }, { key: "volume", label: "Volume" }, { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" }, { key: "patterns", label: "Padrões" },
  { key: "trend", label: "Tendências" }, { key: "channel", label: "Canal" },
];

const cycleColor: Record<string, string> = {
  alta: "#2ebd85", acumulação: "#22d3ee", distribuição: "#fbbf24", depressão: "#e04f5f",
};

export default function Stock() {
  const { symbol: raw } = useParams();
  const symbol = (raw || "IONQ").toUpperCase();

  const [interval, setInterval] = useState("D");
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [data, setData] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const money = (v: number, cur = "USD") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur }).format(v);

  const load = useCallback(async (sym: string, intv: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await fetchStock(sym, intv));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(symbol, interval); /* eslint-disable-next-line */ }, [symbol]);

  const changeInterval = (intv: string) => { setInterval(intv); load(symbol, intv); };
  const toggleLayer = (key: keyof Layers) => setLayers((l) => ({ ...l, [key]: !l[key] }));

  const q = data?.quote;

  return (
    <div className="page coin">
      <div className="coin-header">
        <div className="coin-title">
          <h1>{symbol}</h1>
          {data && <ScoreBadge score={data.score} />}
          {data?.structures?.cycle && (
            <span className="cycle-badge" title={data.structures.cycle.note}
              style={{ borderColor: cycleColor[data.structures.cycle.phase] || "var(--border)", color: cycleColor[data.structures.cycle.phase] || "var(--text-dim)" }}>
              ciclo: {data.structures.cycle.phase}
            </span>
          )}
        </div>
        {q && (
          <div className="coin-price">
            <span className="big-price">{money(q.price, q.currency)}</span>
            <span className={`pct ${changeClass(q.changePct)}`}>{q.changePct >= 0 ? "▲" : "▼"} {pct(q.changePct)} (dia)</span>
          </div>
        )}
      </div>

      <div className="chart-col">
        <div className="chart-controls">
          <div className="intervals">
            {INTERVALS.map((i) => (
              <button key={i.value} className={interval === i.value ? "chip active" : "chip"} onClick={() => changeInterval(i.value)}>{i.label}</button>
            ))}
          </div>
          <div className="layer-toggles">
            {LAYER_LABELS.map((l) => (
              <button key={l.key} className={layers[l.key] ? "layer on" : "layer"} onClick={() => toggleLayer(l.key)}>{l.label}</button>
            ))}
          </div>
        </div>
        <div className="chart-wrap">
          {loading && <div className="overlay">Carregando…</div>}
          {error && <div className="error-box">{error}</div>}
          {data && <Chart data={data} layers={layers} />}
        </div>
      </div>
    </div>
  );
}
