// Estruturas de gráfico desenháveis: linhas de tendência (alta/baixa),
// canal, marcadores de halving e uma leitura heurística da fase do ciclo.

import type { Candle } from "./bybit.js";
import { ema, rsi } from "./indicators.js";

export interface Point { time: number; price: number; }
export interface Line { p1: Point; p2: Point; }

export interface Structures {
  trendUp: Line | null; // suporte (fundos ascendentes)
  trendDown: Line | null; // resistência (topos descendentes)
  channel: { upper: Line; lower: Line } | null;
  halvings: number[]; // timestamps (só BTC), dentro do range visível
  cycle: { phase: string; note: string };
}

const lastValid = (arr: (number | null)[]): number | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};

// pivôs de swing (topos/fundos locais)
function swings(candles: Candle[], k = 5) {
  const highs: Point[] = [];
  const lows: Point[] = [];
  for (let i = k; i < candles.length - k; i++) {
    const win = candles.slice(i - k, i + k + 1);
    if (candles[i].high >= Math.max(...win.map((c) => c.high)))
      highs.push({ time: candles[i].time, price: candles[i].high });
    if (candles[i].low <= Math.min(...win.map((c) => c.low)))
      lows.push({ time: candles[i].time, price: candles[i].low });
  }
  return { highs, lows };
}

// estende a reta que passa por dois pontos até as bordas do gráfico [t0, tN]
function extend(a: Point, b: Point, t0: number, tN: number): Line {
  const slope = (b.price - a.price) / ((b.time - a.time) || 1);
  const at = (t: number) => a.price + slope * (t - a.time);
  return { p1: { time: t0, price: at(t0) }, p2: { time: tN, price: at(tN) } };
}

const BTC_HALVINGS = [1354060800, 1467990000, 1589155200, 1713571200, 1839600000];

export function detectStructures(candles: Candle[], symbol: string): Structures {
  const empty: Structures = { trendUp: null, trendDown: null, channel: null, halvings: [], cycle: { phase: "indefinido", note: "" } };
  if (candles.length < 40) return empty;

  const t0 = candles[0].time;
  const tN = candles[candles.length - 1].time;
  const { highs, lows } = swings(candles);

  // linha de tendência: conecta os dois últimos swings, estendida
  const trendUp = lows.length >= 2 ? extend(lows[lows.length - 2], lows[lows.length - 1], t0, tN) : null;
  const trendDown = highs.length >= 2 ? extend(highs[highs.length - 2], highs[highs.length - 1], t0, tN) : null;

  // canal: usa o suporte como base e desloca pra cima pela maior distância dos topos
  let channel: Structures["channel"] = null;
  if (trendUp) {
    const slope = (trendUp.p2.price - trendUp.p1.price) / ((trendUp.p2.time - trendUp.p1.time) || 1);
    const at = (t: number) => trendUp.p1.price + slope * (t - trendUp.p1.time);
    let offset = 0;
    for (const c of candles) offset = Math.max(offset, c.high - at(c.time));
    channel = {
      lower: trendUp,
      upper: { p1: { time: trendUp.p1.time, price: trendUp.p1.price + offset }, p2: { time: trendUp.p2.time, price: trendUp.p2.price + offset } },
    };
  }

  const halvings = symbol.startsWith("BTC") ? BTC_HALVINGS.filter((h) => h >= t0 && h <= tN) : [];

  // fase do ciclo (heurística): preço vs EMA200, drawdown do topo, RSI
  const closes = candles.map((c) => c.close);
  const price = closes[closes.length - 1];
  const ema200 = lastValid(ema(closes, 200));
  const rsiNow = lastValid(rsi(closes, 14)) ?? 50;
  const maxHigh = Math.max(...candles.map((c) => c.high));
  const drawdown = (price - maxHigh) / maxHigh; // ≤ 0

  let phase = "acumulação";
  let note = "";
  const aboveEma = ema200 !== null ? price > ema200 : price > closes[0];
  if (aboveEma) {
    if (drawdown > -0.08 && rsiNow > 62) { phase = "distribuição"; note = "Perto das máximas com RSI esticado — risco de topo/realização."; }
    else { phase = "alta"; note = "Preço acima da média longa, tendência construtiva."; }
  } else {
    if (drawdown < -0.5) { phase = "depressão"; note = "Queda profunda desde o topo — zona de capitulação/acumulação de longo prazo."; }
    else { phase = "acumulação"; note = "Abaixo da média longa; base sendo formada ou tendência de baixa."; }
  }

  return { trendUp, trendDown, channel, halvings, cycle: { phase, note } };
}
