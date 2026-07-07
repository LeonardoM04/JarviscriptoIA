// Conexões WebSocket públicas da Bybit — vela ao vivo (spot) e liquidações
// ao vivo (perpétuos lineares). Sem chave, direto do navegador.

import type { Candle, Liquidation } from "./types";

// intervalos que usamos → tópico de kline da Bybit (iguais, exceto rótulos)
const KLINE_INTERVAL: Record<string, string> = { "15": "15", "60": "60", "240": "240", D: "D", W: "W" };

export function subscribeKline(
  symbol: string,
  interval: string,
  onCandle: (c: Candle) => void
): () => void {
  const topic = `kline.${KLINE_INTERVAL[interval] ?? "60"}.${symbol}`;
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/spot");
  let alive = true;
  let ping: ReturnType<typeof setInterval> | undefined;

  ws.onopen = () => {
    ws.send(JSON.stringify({ op: "subscribe", args: [topic] }));
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ op: "ping" })), 20000);
  };
  ws.onmessage = (ev) => {
    if (!alive) return;
    const msg = JSON.parse(ev.data);
    if (msg.topic !== topic || !Array.isArray(msg.data)) return;
    for (const k of msg.data) {
      onCandle({
        time: Math.floor(Number(k.start) / 1000),
        open: Number(k.open),
        high: Number(k.high),
        low: Number(k.low),
        close: Number(k.close),
        volume: Number(k.volume),
      });
    }
  };

  return () => {
    alive = false;
    if (ping) clearInterval(ping);
    try { ws.close(); } catch { /* noop */ }
  };
}

export function subscribeLiquidations(
  symbol: string,
  onLiq: (l: Liquidation) => void
): () => void {
  const topic = `allLiquidation.${symbol}`;
  const ws = new WebSocket("wss://stream.bybit.com/v5/public/linear");
  let alive = true;
  let ping: ReturnType<typeof setInterval> | undefined;

  ws.onopen = () => {
    ws.send(JSON.stringify({ op: "subscribe", args: [topic] }));
    ping = setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ op: "ping" })), 20000);
  };
  ws.onmessage = (ev) => {
    if (!alive) return;
    const msg = JSON.parse(ev.data);
    if (msg.topic !== topic || !Array.isArray(msg.data)) return;
    for (const d of msg.data) {
      const price = Number(d.p);
      const size = Number(d.v);
      // Bybit: S = lado da ordem de liquidação. "Sell" fecha um long; "Buy" fecha um short.
      onLiq({
        time: Number(d.T),
        side: d.S === "Sell" ? "long" : "short",
        price,
        sizeUsd: price * size,
      });
    }
  };

  return () => {
    alive = false;
    if (ping) clearInterval(ping);
    try { ws.close(); } catch { /* noop */ }
  };
}
