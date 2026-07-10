import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Chart, { type ChartHandle, type Layers } from "../components/Chart";
import ScoreBadge from "../components/ScoreBadge";
import AnalysisPanel from "../components/AnalysisPanel";
import { fetchStock, requestStockAnalysis } from "../api";
import type { AnalyzeResponse, StockDetail } from "../types";
import { changeClass, pct, timeAgo } from "../utils";

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

type Tab = "analise" | "noticias";

export default function Stock() {
  const { symbol: raw } = useParams();
  const symbol = (raw || "IONQ").toUpperCase();

  const [interval, setInterval] = useState("D");
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [data, setData] = useState<StockDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("analise");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const chartRef = useRef<ChartHandle>(null);

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

  useEffect(() => {
    load(symbol, interval);
    setAnalysis(null);
    setAnalysisError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const changeInterval = (intv: string) => { setInterval(intv); load(symbol, intv); };
  const toggleLayer = (key: keyof Layers) => setLayers((l) => ({ ...l, [key]: !l[key] }));

  const analyze = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const image = chartRef.current?.screenshot() ?? undefined;
      setAnalysis(await requestStockAnalysis(symbol, image));
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const q = data?.quote;

  return (
    <div className="page coin">
      <div className="coin-header">
        <div className="coin-title">
          <h1>{data?.name || symbol}{data?.name && <span className="dim"> · {symbol}</span>}</h1>
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

      <div className="coin-body">
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
            {data && <Chart ref={chartRef} data={data} layers={layers} />}
          </div>
        </div>

        <div className="side-col">
          <div className="tabs">
            <button className={tab === "analise" ? "tab on" : "tab"} onClick={() => setTab("analise")}>Análise IA</button>
            <button className={tab === "noticias" ? "tab on" : "tab"} onClick={() => setTab("noticias")}>Notícias</button>
          </div>

          {tab === "analise" && (
            <AnalysisPanel result={analysis} loading={analysisLoading} error={analysisError} onAnalyze={analyze} />
          )}

          {tab === "noticias" && (
            <ul className="news-list">
              {data?.news?.length ? data.news.map((n, i) => (
                <li key={i}>
                  <span className="dot neutro" />
                  <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                  <span className="news-meta">{n.source} · {timeAgo(n.publishedAt)}</span>
                </li>
              )) : <li className="dim">Sem notícias para esta ação.</li>}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
