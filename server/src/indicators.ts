// Indicadores técnicos calculados em TypeScript puro.
// Todos os arrays retornados têm o mesmo comprimento das velas,
// com null nas posições onde ainda não há dados suficientes.

import type { Candle } from "./bybit.js";

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  // semente: SMA do primeiro período
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

// RSI de Wilder (14 padrão)
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine: Series = values.map((_, i) =>
    emaFast[i] !== null && emaSlow[i] !== null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );
  // sinal = EMA do MACD apenas na região válida
  const firstValid = macdLine.findIndex((v) => v !== null);
  const signal: Series = new Array(values.length).fill(null);
  const histogram: Series = new Array(values.length).fill(null);
  if (firstValid >= 0) {
    const valid = macdLine.slice(firstValid) as number[];
    const sig = ema(valid, signalPeriod);
    for (let i = 0; i < sig.length; i++) {
      signal[firstValid + i] = sig[i];
      if (sig[i] !== null) {
        histogram[firstValid + i] = valid[i] - (sig[i] as number);
      }
    }
  }
  return { macd: macdLine, signal, histogram };
}

export interface BollingerResult {
  upper: Series;
  middle: Series;
  lower: Series;
}

export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    const mean = middle[i] as number;
    const variance = slice.reduce((a, v) => a + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { upper, middle, lower };
}

export interface IndicatorSet {
  ema21: Series;
  ema50: Series;
  ema200: Series;
  rsi14: Series;
  macd: MacdResult;
  bollinger: BollingerResult;
}

export function computeIndicators(candles: Candle[]): IndicatorSet {
  const closes = candles.map((c) => c.close);
  return {
    ema21: ema(closes, 21),
    ema50: ema(closes, 50),
    ema200: ema(closes, 200),
    rsi14: rsi(closes, 14),
    macd: macd(closes),
    bollinger: bollinger(closes),
  };
}

// Suportes e resistências simples por pivôs locais
export function findLevels(candles: Candle[], lookback = 10): { supports: number[]; resistances: number[] } {
  const supports: number[] = [];
  const resistances: number[] = [];
  for (let i = lookback; i < candles.length - lookback; i++) {
    const isLow = candles.slice(i - lookback, i + lookback + 1).every((c) => candles[i].low <= c.low);
    const isHigh = candles.slice(i - lookback, i + lookback + 1).every((c) => candles[i].high >= c.high);
    if (isLow) supports.push(candles[i].low);
    if (isHigh) resistances.push(candles[i].high);
  }
  // deduplica níveis muito próximos (0.5%)
  const dedupe = (arr: number[]) => {
    const sorted = [...arr].sort((a, b) => a - b);
    const out: number[] = [];
    for (const v of sorted) {
      if (!out.length || Math.abs(v - out[out.length - 1]) / v > 0.005) out.push(v);
    }
    return out;
  };
  return { supports: dedupe(supports).slice(-5), resistances: dedupe(resistances).slice(-5) };
}
