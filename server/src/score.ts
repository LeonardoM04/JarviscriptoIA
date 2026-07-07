// "Score Jarvis" — nota 0-100 determinística que resume tendência + momentum
// + posição relativa. Serve como triagem rápida; a análise profunda é da IA.

import type { Candle } from "./bybit.js";
import { computeIndicators } from "./indicators.js";

const last = <T>(arr: (T | null)[]): T | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};

export interface ScoreResult {
  score: number; // 0-100
  momentum: "acumulação" | "lateral" | "distribuição";
  label: string;
}

export function jarvisScore(candles: Candle[]): ScoreResult {
  if (candles.length < 50) {
    return { score: 50, momentum: "lateral", label: "Dados insuficientes" };
  }
  const ind = computeIndicators(candles);
  const price = candles[candles.length - 1].close;
  const ema21 = last(ind.ema21);
  const ema50 = last(ind.ema50);
  const ema200 = last(ind.ema200);
  const rsi = last(ind.rsi14);
  const macdH = last(ind.macd.histogram);

  let score = 50;

  // Alinhamento de médias (tendência)
  if (ema21 && ema50 && ema200) {
    if (price > ema21 && ema21 > ema50 && ema50 > ema200) score += 20;
    else if (price < ema21 && ema21 < ema50 && ema50 < ema200) score -= 20;
    else {
      if (price > ema50) score += 6;
      else score -= 6;
      if (ema50 > ema200) score += 6;
      else score -= 6;
    }
  }

  // RSI (momentum, mas penaliza extremos)
  if (rsi !== null) {
    if (rsi > 50 && rsi < 70) score += 10;
    else if (rsi >= 70) score += 2; // sobrecomprado: força, porém risco
    else if (rsi < 50 && rsi > 30) score -= 10;
    else if (rsi <= 30) score -= 2; // sobrevendido: fraqueza, porém repique possível
  }

  // Histograma MACD (aceleração)
  if (macdH !== null) score += macdH > 0 ? 10 : -10;

  // Retorno de 7 velas (impulso recente)
  const back = candles[candles.length - 8]?.close;
  if (back) {
    const chg = (price - back) / back;
    score += Math.max(-10, Math.min(10, chg * 100));
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const momentum: ScoreResult["momentum"] =
    score >= 62 ? "acumulação" : score <= 38 ? "distribuição" : "lateral";
  const label =
    score >= 75 ? "Forte" : score >= 62 ? "Positivo" : score >= 45 ? "Neutro" : score >= 30 ? "Frágil" : "Fraco";
  return { score, momentum, label };
}
