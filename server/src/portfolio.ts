// Cálculo da carteira do grupo: posições (custo médio), P/L realizado/não
// realizado com preços ao vivo, e análise da carteira inteira pelo Jarvis.

import Anthropic from "@anthropic-ai/sdk";
import type { Tx } from "./store.js";
import { getTicker } from "./bybit.js";
import { getStockChart } from "./stocks.js";

export interface Position {
  symbol: string;
  assetType: "cripto" | "acao";
  quantity: number;
  avgPrice: number;
  invested: number;
  realizedPnl: number;
  currentPrice?: number;
  marketValue?: number;
  unrealizedPnl?: number;
}

// custo médio ponderado, processando as transações em ordem
export function computePositions(txs: Tx[]): Position[] {
  const map = new Map<string, { assetType: "cripto" | "acao"; qty: number; cost: number; realized: number }>();
  for (const t of txs) {
    const key = `${t.assetType}:${t.symbol}`;
    const p = map.get(key) || { assetType: t.assetType, qty: 0, cost: 0, realized: 0 };
    if (t.side === "compra") {
      p.qty += t.quantity;
      p.cost += t.quantity * t.price;
    } else {
      const avg = p.qty > 0 ? p.cost / p.qty : t.price;
      p.realized += (t.price - avg) * t.quantity;
      p.cost -= avg * t.quantity;
      p.qty -= t.quantity;
      if (p.qty < 1e-9) { p.qty = 0; p.cost = 0; }
    }
    map.set(key, p);
  }
  return [...map.entries()].map(([key, p]) => {
    const symbol = key.split(":")[1];
    const avgPrice = p.qty > 0 ? p.cost / p.qty : 0;
    return { symbol, assetType: p.assetType, quantity: p.qty, avgPrice, invested: p.qty * avgPrice, realizedPnl: p.realized };
  });
}

// quanto cada sócio aportou (líquido: compras - vendas)
export function perPerson(txs: Tx[]): { person: string; net: number }[] {
  const map = new Map<string, number>();
  for (const t of txs) {
    const amount = t.quantity * t.price * (t.side === "compra" ? 1 : -1);
    map.set(t.person, (map.get(t.person) || 0) + amount);
  }
  return [...map.entries()].map(([person, net]) => ({ person, net })).sort((a, b) => b.net - a.net);
}

async function priceOf(p: Position): Promise<number | null> {
  try {
    if (p.assetType === "acao") return (await getStockChart(p.symbol, "D")).price;
    return (await getTicker(p.symbol + "USDT")).lastPrice;
  } catch {
    return null;
  }
}

export async function buildPortfolio(txs: Tx[]) {
  const positions = computePositions(txs);
  const open = positions.filter((p) => p.quantity > 1e-9);

  await Promise.all(open.map(async (p) => {
    const price = await priceOf(p);
    if (price !== null) {
      p.currentPrice = price;
      p.marketValue = p.quantity * price;
      p.unrealizedPnl = (price - p.avgPrice) * p.quantity;
    }
  }));

  const totalInvested = open.reduce((s, p) => s + p.invested, 0);
  const totalMarket = open.reduce((s, p) => s + (p.marketValue ?? p.invested), 0);
  const totalUnrealized = open.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0);
  const totalRealized = positions.reduce((s, p) => s + p.realizedPnl, 0);

  return {
    transactions: txs,
    positions: open,
    people: perPerson(txs),
    summary: {
      totalInvested,
      totalMarket,
      totalUnrealized,
      totalUnrealizedPct: totalInvested ? (totalUnrealized / totalInvested) * 100 : 0,
      totalRealized,
    },
  };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export async function analyzePortfolio(txs: Tx[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY não configurada.");
  const data = await buildPortfolio(txs);
  if (!data.positions.length) return "A carteira está vazia. Registre alguns aportes primeiro que eu analiso.";

  const posLines = data.positions.map((p) => {
    const w = data.summary.totalMarket ? ((p.marketValue ?? 0) / data.summary.totalMarket) * 100 : 0;
    return `- ${p.symbol} (${p.assetType}): ${w.toFixed(1)}% da carteira | investido ${fmt(p.invested)}, valor atual ${fmt(p.marketValue ?? 0)}, P/L ${fmt(p.unrealizedPnl ?? 0)}`;
  }).join("\n");

  const client = new Anthropic();
  const system = [
    "Você é o Jarvis, gestor de risco da Quad₿lock Capital, analisando a carteira dos três sócios.",
    "Faça uma análise CURTA e prática (4-6 frases): concentração de risco (algum ativo pesado demais?), diversificação (cripto vs ações vs setores), o que está puxando o resultado, e 1-2 sugestões de atenção. Nunca prometa lucro; fale em risco. Português.",
  ].join("\n");
  const content = [
    `Carteira do grupo:`,
    `- Total investido: ${fmt(data.summary.totalInvested)} | Valor atual: ${fmt(data.summary.totalMarket)} | P/L não realizado: ${fmt(data.summary.totalUnrealized)} (${data.summary.totalUnrealizedPct.toFixed(1)}%) | P/L realizado: ${fmt(data.summary.totalRealized)}`,
    ``,
    `Posições:`,
    posLines,
  ].join("\n");

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 1200,
    system,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content }],
  });
  const t = response.content.find((b) => b.type === "text");
  return t && t.type === "text" ? t.text : "Não consegui analisar agora.";
}
