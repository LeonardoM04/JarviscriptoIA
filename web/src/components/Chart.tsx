import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";
import type { Candle, KlinesResponse, Series } from "../types";

export interface Layers {
  ema21: boolean;
  ema50: boolean;
  ema200: boolean;
  bollinger: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  patterns: boolean;
  trend: boolean;
  channel: boolean;
  halving: boolean;
}

export interface ChartHandle {
  screenshot: () => string | null; // PNG data URL
  updateCandle: (c: Candle) => void; // atualização ao vivo da última vela
}

interface Props {
  data: KlinesResponse;
  layers: Layers;
}

const toLine = (times: number[], series: Series) =>
  times
    .map((t, i) => ({ time: t as UTCTimestamp, value: series[i] }))
    .filter((p): p is { time: UTCTimestamp; value: number } => p.value !== null);

const Chart = forwardRef<ChartHandle, Props>(({ data, layers }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastTimeRef = useRef<number>(0);
  const [clicked, setClicked] = useState<{ candle: Candle; patterns: string[] } | null>(null);

  useImperativeHandle(ref, () => ({
    screenshot: () => {
      const canvas = chartRef.current?.takeScreenshot();
      return canvas ? canvas.toDataURL("image/png") : null;
    },
    updateCandle: (c: Candle) => {
      // só aceita a vela em formação ou uma nova (evita "cannot update oldest")
      if (!candleSeriesRef.current || c.time < lastTimeRef.current) return;
      lastTimeRef.current = c.time;
      candleSeriesRef.current.update({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      });
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#0b0e14" },
        textColor: "#7d8590",
        fontSize: 11,
        panes: { separatorColor: "#1c2128" },
      },
      grid: {
        vertLines: { color: "rgba(28,33,40,0.5)" },
        horzLines: { color: "rgba(28,33,40,0.5)" },
      },
      crosshair: { mode: 0 },
      timeScale: { timeVisible: true, borderColor: "#1c2128" },
      rightPriceScale: { borderColor: "#1c2128" },
      autoSize: true,
    });
    chartRef.current = chart;

    const times = data.candles.map((c) => c.time);

    // painéis extras: cada indicador de painel ganha um índice sequencial
    let paneIdx = 0;
    const rsiPane = layers.rsi ? ++paneIdx : -1;
    const macdPane = layers.macd ? ++paneIdx : -1;

    // ---- Pane 0: velas ----
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#2ebd85",
      downColor: "#e04f5f",
      borderVisible: false,
      wickUpColor: "#2ebd85",
      wickDownColor: "#e04f5f",
    });
    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );
    candleSeriesRef.current = candleSeries;
    lastTimeRef.current = data.candles.length ? data.candles[data.candles.length - 1].time : 0;

    const emaDefs: { on: boolean; key: keyof KlinesResponse["indicators"]; color: string; title: string }[] = [
      { on: layers.ema21, key: "ema21", color: "#c084fc", title: "EMA 21" },
      { on: layers.ema50, key: "ema50", color: "#fbbf24", title: "EMA 50" },
      { on: layers.ema200, key: "ema200", color: "#f87171", title: "EMA 200" },
    ];
    for (const def of emaDefs) {
      if (!def.on) continue;
      const s = chart.addSeries(LineSeries, {
        color: def.color,
        lineWidth: 2,
        title: def.title,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      s.setData(toLine(times, data.indicators[def.key] as Series));
    }

    if (layers.bollinger) {
      for (const [key, dash] of [["upper", 2], ["lower", 2]] as const) {
        const s = chart.addSeries(LineSeries, {
          color: "rgba(125,139,148,0.7)",
          lineWidth: 1,
          lineStyle: dash,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        s.setData(toLine(times, data.indicators.bollinger[key]));
      }
    }

    if (layers.volume) {
      const volumeSeries = chart.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        priceLineVisible: false,
        lastValueVisible: false,
      });
      chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } });
      volumeSeries.setData(
        data.candles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? "rgba(46,189,133,0.3)" : "rgba(224,79,95,0.3)",
        }))
      );
    }

    // ---- estruturas: linhas de tendência, canal, halving ----
    const drawLine = (line: { p1: { time: number; price: number }; p2: { time: number; price: number } }, color: string, title: string, dashed = false) => {
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: 2, lineStyle: dashed ? 2 : 0, title,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      s.setData([
        { time: line.p1.time as UTCTimestamp, value: line.p1.price },
        { time: line.p2.time as UTCTimestamp, value: line.p2.price },
      ]);
    };

    if (layers.trend) {
      if (data.structures.trendUp) drawLine(data.structures.trendUp, "#2ebd85", "Tendência alta");
      if (data.structures.trendDown) drawLine(data.structures.trendDown, "#e04f5f", "Tendência baixa");
    }
    if (layers.channel && data.structures.channel) {
      drawLine(data.structures.channel.upper, "rgba(34,211,238,0.7)", "Canal", true);
      drawLine(data.structures.channel.lower, "rgba(34,211,238,0.7)", "Canal", true);
    }

    // marcadores (padrões de vela + halving) — uma chamada só
    const markers: SeriesMarker<Time>[] = [];
    if (layers.patterns) {
      // marcadores minimalistas (sem texto) — o nome do padrão aparece ao clicar na vela
      for (const p of data.patterns.slice(-40)) {
        markers.push({
          time: p.time as UTCTimestamp,
          position: p.direction === "bearish" ? "aboveBar" : "belowBar",
          color: p.direction === "bullish" ? "#2ebd85" : p.direction === "bearish" ? "#e04f5f" : "#fbbf24",
          shape: p.direction === "bullish" ? "arrowUp" : p.direction === "bearish" ? "arrowDown" : "circle",
          size: 0,
        });
      }
    }
    if (layers.halving) {
      for (const h of data.structures.halvings) {
        markers.push({ time: h as UTCTimestamp, position: "aboveBar", color: "#f59e0b", shape: "circle", text: "⛏ Halving", size: 2 });
      }
    }
    if (markers.length) {
      markers.sort((a, b) => (a.time as number) - (b.time as number));
      createSeriesMarkers(candleSeries, markers);
    }

    if (rsiPane > 0) {
      const rsiSeries = chart.addSeries(
        LineSeries,
        { color: "#22d3ee", lineWidth: 2, title: "RSI 14", priceLineVisible: false },
        rsiPane
      );
      rsiSeries.setData(toLine(times, data.indicators.rsi14));
      rsiSeries.createPriceLine({ price: 70, color: "#e04f5f", lineWidth: 1, lineStyle: 2, title: "70" });
      rsiSeries.createPriceLine({ price: 30, color: "#2ebd85", lineWidth: 1, lineStyle: 2, title: "30" });
    }

    if (macdPane > 0) {
      const histSeries = chart.addSeries(HistogramSeries, { priceLineVisible: false, lastValueVisible: false }, macdPane);
      histSeries.setData(
        times
          .map((t, i) => {
            const v = data.indicators.macd.histogram[i];
            return v === null
              ? null
              : { time: t as UTCTimestamp, value: v, color: v >= 0 ? "rgba(46,189,133,0.6)" : "rgba(224,79,95,0.6)" };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null)
      );
      const macdSeries = chart.addSeries(LineSeries, { color: "#60a5fa", lineWidth: 1, title: "MACD", priceLineVisible: false }, macdPane);
      macdSeries.setData(toLine(times, data.indicators.macd.macd));
      const signalSeries = chart.addSeries(LineSeries, { color: "#f97316", lineWidth: 1, title: "Sinal", priceLineVisible: false }, macdPane);
      signalSeries.setData(toLine(times, data.indicators.macd.signal));
    }

    // proporções: painel principal domina
    const panes = chart.panes();
    panes.forEach((p, i) => p.setStretchFactor(i === 0 ? 4 : 1));

    chart.timeScale().fitContent();

    // clicar numa vela → mostra OHLC, data/hora e padrão (se houver)
    setClicked(null);
    chart.subscribeClick((param) => {
      const t = param.time as number | undefined;
      if (t == null) { setClicked(null); return; }
      const candle = data.candles.find((c) => c.time === t);
      if (!candle) { setClicked(null); return; }
      const pats = data.patterns.filter((p) => p.time === t).map((p) => p.name);
      setClicked({ candle, patterns: pats });
    });

    return () => {
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [data, layers]);

  const fmtNum = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v < 1 ? 6 : 2 });
  const chg = clicked ? ((clicked.candle.close - clicked.candle.open) / clicked.candle.open) * 100 : 0;

  return (
    <div className="chart-host">
      <div ref={containerRef} className="chart-container" />
      {clicked && (
        <div className="candle-info">
          <button className="candle-info-close" onClick={() => setClicked(null)}>×</button>
          <div className="candle-info-date">
            {new Date(clicked.candle.time * 1000).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" })}
          </div>
          <div className="candle-info-grid">
            <span>Abertura</span><b>{fmtNum(clicked.candle.open)}</b>
            <span>Máxima</span><b>{fmtNum(clicked.candle.high)}</b>
            <span>Mínima</span><b>{fmtNum(clicked.candle.low)}</b>
            <span>Fechamento</span><b className={chg >= 0 ? "up" : "down"}>{fmtNum(clicked.candle.close)}</b>
            <span>Variação</span><b className={chg >= 0 ? "up" : "down"}>{chg >= 0 ? "+" : ""}{chg.toFixed(2)}%</b>
            <span>Volume</span><b>{clicked.candle.volume.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</b>
          </div>
          <div className="candle-info-pat">
            {clicked.patterns.length ? clicked.patterns.map((p) => <span key={p} className="pat-chip">{p}</span>) : <span className="dim">Nenhum padrão nesta vela</span>}
          </div>
        </div>
      )}
    </div>
  );
});

Chart.displayName = "Chart";
export default Chart;
