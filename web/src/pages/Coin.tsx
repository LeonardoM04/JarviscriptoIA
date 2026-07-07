import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Chart, { type ChartHandle, type Layers } from "../components/Chart";
import AnalysisPanel from "../components/AnalysisPanel";
import ScoreBadge from "../components/ScoreBadge";
import WhalePanel from "../components/WhalePanel";
import { fetchCoin, fetchKlines, fetchTicker, requestAnalysis } from "../api";
import { subscribeKline, subscribeLiquidations } from "../bybitStream";
import type { AnalyzeResponse, CoinDetail, Derivatives, KlinesResponse, Liquidation, NewsItem, Ticker } from "../types";
import { changeClass, compact, money, pct, timeAgo } from "../utils";

const INTERVALS = [
  { value: "15", label: "15m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "1D" },
  { value: "W", label: "1S" },
];

const DEFAULT_LAYERS: Layers = {
  ema21: false, ema50: true, ema200: false, bollinger: false, volume: true, rsi: false, macd: false, patterns: false,
};

const LAYER_LABELS: { key: keyof Layers; label: string }[] = [
  { key: "ema21", label: "EMA 21" }, { key: "ema50", label: "EMA 50" }, { key: "ema200", label: "EMA 200" },
  { key: "bollinger", label: "Bollinger" }, { key: "volume", label: "Volume" }, { key: "rsi", label: "RSI" },
  { key: "macd", label: "MACD" }, { key: "patterns", label: "Padrões" },
];

type Tab = "analise" | "baleias" | "noticias" | "fundamentos";

export default function Coin() {
  const { symbol: raw } = useParams();
  const symbol = (raw || "BTC").toUpperCase().replace(/USDT$/, "") + "USDT";

  const [interval, setInterval] = useState("60");
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [klines, setKlines] = useState<KlinesResponse | null>(null);
  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [derivatives, setDerivatives] = useState<Derivatives | null>(null);
  const [detail, setDetail] = useState<CoinDetail | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [live, setLive] = useState(false);
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);

  const [tab, setTab] = useState<Tab>("analise");
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const chartRef = useRef<ChartHandle>(null);

  const loadChart = useCallback(async (sym: string, intv: string) => {
    setLoading(true);
    setError(null);
    try {
      const [k, t] = await Promise.all([fetchKlines(sym, intv), fetchTicker(sym)]);
      setKlines(k);
      setTicker(t.ticker);
      setDerivatives(t.derivatives);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setKlines(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLivePrice(null);
    loadChart(symbol, interval);
    setAnalysis(null);
    setAnalysisError(null);
    fetchCoin(symbol).then((c) => { setDetail(c.detail); setNews(c.news); }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  // vela ao vivo (WebSocket spot)
  useEffect(() => {
    const unsub = subscribeKline(symbol, interval, (c) => {
      chartRef.current?.updateCandle(c);
      setLivePrice(c.close);
      setLive(true);
    });
    return () => { unsub(); setLive(false); };
  }, [symbol, interval]);

  // liquidações ao vivo (WebSocket linear)
  useEffect(() => {
    setLiquidations([]);
    const unsub = subscribeLiquidations(symbol, (l) => {
      setLiquidations((prev) => [l, ...prev].slice(0, 20));
    });
    return () => unsub();
  }, [symbol]);

  const changeInterval = (intv: string) => { setInterval(intv); loadChart(symbol, intv); };
  const toggleLayer = (key: keyof Layers) => setLayers((l) => ({ ...l, [key]: !l[key] }));

  const analyze = async () => {
    setAnalysisLoading(true);
    setAnalysisError(null);
    try {
      const image = chartRef.current?.screenshot() ?? undefined;
      setAnalysis(await requestAnalysis(symbol, image));
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : String(e));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const pctVal = ticker?.price24hPcnt ?? 0;
  const displayPrice = livePrice ?? ticker?.lastPrice ?? null;

  return (
    <div className="page coin">
      <div className="coin-header">
        <div className="coin-title">
          <h1>{symbol.replace(/USDT$/, "")}<span className="dim">/USDT</span></h1>
          {klines && <ScoreBadge score={klines.score} />}
        </div>
        {displayPrice !== null && (
          <div className="coin-price">
            {live && <span className="live-dot" title="tempo real" />}
            <span className="big-price">{money(displayPrice)}</span>
            <span className={`pct ${changeClass(pctVal)}`}>{pctVal >= 0 ? "▲" : "▼"} {pct(pctVal)} (24h)</span>
          </div>
        )}
        {derivatives?.available && (
          <div className="deriv-strip">
            <span>Funding <b className={changeClass(derivatives.fundingRate)}>{derivatives.fundingRate?.toFixed(4)}%</b></span>
            <span>OI <b>{derivatives.oiTrend ?? "—"}</b></span>
            {derivatives.buyRatio != null && (
              <span>L/S <b>{(derivatives.buyRatio * 100).toFixed(0)}/{((derivatives.sellRatio ?? 0) * 100).toFixed(0)}</b></span>
            )}
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
            {klines && <Chart ref={chartRef} data={klines} layers={layers} />}
          </div>
        </div>

        <div className="side-col">
          <div className="tabs">
            <button className={tab === "analise" ? "tab on" : "tab"} onClick={() => setTab("analise")}>Análise IA</button>
            <button className={tab === "baleias" ? "tab on" : "tab"} onClick={() => setTab("baleias")}>🐋 Baleias</button>
            <button className={tab === "noticias" ? "tab on" : "tab"} onClick={() => setTab("noticias")}>Notícias</button>
            <button className={tab === "fundamentos" ? "tab on" : "tab"} onClick={() => setTab("fundamentos")}>Dados</button>
          </div>

          {tab === "analise" && (
            <AnalysisPanel result={analysis} loading={analysisLoading} error={analysisError} onAnalyze={analyze} />
          )}

          {tab === "baleias" && <WhalePanel derivatives={derivatives} liquidations={liquidations} />}

          {tab === "noticias" && (
            <ul className="news-list">
              {news.length ? news.map((n, i) => (
                <li key={i}>
                  <span className={`dot ${n.sentiment}`} />
                  <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
                  <span className="news-meta">{n.source} · {timeAgo(n.publishedAt)}</span>
                </li>
              )) : <li className="dim">Sem notícias para esta moeda.</li>}
            </ul>
          )}

          {tab === "fundamentos" && (
            <div className="fundamentals">
              {detail ? (
                <>
                  <p>{detail.description || "Sem descrição disponível."}</p>
                  <div className="fund-grid">
                    <div><span>Rank</span><b>#{detail.marketCapRank ?? "—"}</b></div>
                    <div><span>vs. topo histórico</span><b className={changeClass(detail.athChangePct)}>{pct(detail.athChangePct)}</b></div>
                    <div><span>Circulante</span><b>{detail.circulatingSupply ? detail.circulatingSupply.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}</b></div>
                    <div><span>Máx. supply</span><b>{detail.maxSupply ? detail.maxSupply.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "ilimitado"}</b></div>
                  </div>
                  {detail.categories.length > 0 && <div className="cat-tags">{detail.categories.map((c) => <span key={c} className="tag">{c}</span>)}</div>}
                  {detail.homepage && <a className="ext-link" href={detail.homepage} target="_blank" rel="noreferrer">Site oficial ↗</a>}
                </>
              ) : <p className="dim">Fundamentos indisponíveis para esta moeda.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
