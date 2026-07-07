// Detecção de padrões de velas — portado e ampliado do JarvisCripto v1 (Python)

import type { Candle } from "./bybit.js";

export interface PatternHit {
  time: number; // unix seconds da vela onde o padrão fecha
  name: string;
  direction: "bullish" | "bearish" | "neutral";
}

const body = (c: Candle) => Math.abs(c.close - c.open);
const range = (c: Candle) => c.high - c.low;
const upperShadow = (c: Candle) => c.high - Math.max(c.open, c.close);
const lowerShadow = (c: Candle) => Math.min(c.open, c.close) - c.low;
const isBull = (c: Candle) => c.close > c.open;
const isBear = (c: Candle) => c.close < c.open;

function uptrend(candles: Candle[], i: number, period = 10): boolean {
  if (i < period) return false;
  return candles[i].close > candles[i - period].close;
}
function downtrend(candles: Candle[], i: number, period = 10): boolean {
  if (i < period) return false;
  return candles[i].close < candles[i - period].close;
}

type Detector = (candles: Candle[], i: number) => PatternHit | null;

const detectors: Detector[] = [
  // Doji
  (cs, i) => {
    const c = cs[i];
    if (range(c) > 0 && body(c) < range(c) * 0.05) {
      return { time: c.time, name: "Doji", direction: "neutral" };
    }
    return null;
  },
  // Martelo / Homem Enforcado
  (cs, i) => {
    const c = cs[i];
    if (body(c) > 0 && lowerShadow(c) >= 2 * body(c) && upperShadow(c) < body(c)) {
      if (downtrend(cs, i)) return { time: c.time, name: "Martelo", direction: "bullish" };
      if (uptrend(cs, i)) return { time: c.time, name: "Homem Enforcado", direction: "bearish" };
    }
    return null;
  },
  // Martelo Invertido / Estrela Cadente
  (cs, i) => {
    const c = cs[i];
    if (body(c) > 0 && upperShadow(c) >= 2 * body(c) && lowerShadow(c) < body(c)) {
      if (downtrend(cs, i)) return { time: c.time, name: "Martelo Invertido", direction: "bullish" };
      if (uptrend(cs, i)) return { time: c.time, name: "Estrela Cadente", direction: "bearish" };
    }
    return null;
  },
  // Engolfo de Alta / Baixa
  (cs, i) => {
    if (i < 1) return null;
    const p = cs[i - 1];
    const c = cs[i];
    if (isBear(p) && isBull(c) && c.open < p.close && c.close > p.open) {
      return { time: c.time, name: "Engolfo de Alta", direction: "bullish" };
    }
    if (isBull(p) && isBear(c) && c.open > p.close && c.close < p.open) {
      return { time: c.time, name: "Engolfo de Baixa", direction: "bearish" };
    }
    return null;
  },
  // Kicker (gap com inversão)
  (cs, i) => {
    if (i < 1) return null;
    const p = cs[i - 1];
    const c = cs[i];
    if (isBear(p) && isBull(c) && c.open > p.high) {
      return { time: c.time, name: "Kicker de Alta", direction: "bullish" };
    }
    if (isBull(p) && isBear(c) && c.open < p.low) {
      return { time: c.time, name: "Kicker de Baixa", direction: "bearish" };
    }
    return null;
  },
  // Três Soldados Brancos / Três Corvos Negros
  (cs, i) => {
    if (i < 2) return null;
    const [a, b, c] = [cs[i - 2], cs[i - 1], cs[i]];
    if (
      isBull(a) && isBull(b) && isBull(c) &&
      c.close > b.close && b.close > a.close &&
      b.open > a.open && c.open > b.open
    ) {
      return { time: c.time, name: "Três Soldados Brancos", direction: "bullish" };
    }
    if (
      isBear(a) && isBear(b) && isBear(c) &&
      c.close < b.close && b.close < a.close &&
      b.open < a.open && c.open < b.open
    ) {
      return { time: c.time, name: "Três Corvos Negros", direction: "bearish" };
    }
    return null;
  },
  // Estrela da Manhã / Estrela da Noite
  (cs, i) => {
    if (i < 2) return null;
    const [a, b, c] = [cs[i - 2], cs[i - 1], cs[i]];
    const smallB = range(b) > 0 && body(b) < range(b) * 0.3;
    if (isBear(a) && smallB && isBull(c) && c.close > (a.open + a.close) / 2 && body(a) > 0) {
      return { time: c.time, name: "Estrela da Manhã", direction: "bullish" };
    }
    if (isBull(a) && smallB && isBear(c) && c.close < (a.open + a.close) / 2 && body(a) > 0) {
      return { time: c.time, name: "Estrela da Noite", direction: "bearish" };
    }
    return null;
  },
  // Harami
  (cs, i) => {
    if (i < 1) return null;
    const p = cs[i - 1];
    const c = cs[i];
    const inside = Math.max(c.open, c.close) < Math.max(p.open, p.close) &&
      Math.min(c.open, c.close) > Math.min(p.open, p.close);
    if (inside && body(p) > body(c) * 2) {
      if (isBear(p) && isBull(c)) return { time: c.time, name: "Harami de Alta", direction: "bullish" };
      if (isBull(p) && isBear(c)) return { time: c.time, name: "Harami de Baixa", direction: "bearish" };
    }
    return null;
  },
];

export function detectPatterns(candles: Candle[]): PatternHit[] {
  const hits: PatternHit[] = [];
  for (let i = 0; i < candles.length; i++) {
    for (const d of detectors) {
      const hit = d(candles, i);
      if (hit) hits.push(hit);
    }
  }
  return hits;
}
