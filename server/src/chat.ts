// Jarvis conversacional — o "assistente vivo". Responde perguntas do grupo com
// contexto de mercado ao vivo. Rápido (sem thinking pesado), voz é no cliente.

import Anthropic from "@anthropic-ai/sdk";
import { getTicker, getFearGreed } from "./bybit.js";
import { getGlobal } from "./coingecko.js";

const MODEL = "claude-opus-4-8";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function marketSnapshot(): Promise<string> {
  try {
    const [btc, eth, fg, global] = await Promise.all([
      getTicker("BTCUSDT").catch(() => null),
      getTicker("ETHUSDT").catch(() => null),
      getFearGreed().catch(() => null),
      getGlobal().catch(() => null),
    ]);
    const parts: string[] = [];
    if (btc) parts.push(`BTC $${btc.lastPrice.toFixed(0)} (${btc.price24hPcnt.toFixed(1)}% 24h)`);
    if (eth) parts.push(`ETH $${eth.lastPrice.toFixed(0)} (${eth.price24hPcnt.toFixed(1)}% 24h)`);
    if (fg) parts.push(`Medo & Ganância ${fg.value} (${fg.label})`);
    if (global) parts.push(`dominância BTC ${global.btcDominance.toFixed(1)}%`);
    return parts.join(" · ") || "sem dados de mercado no momento";
  } catch {
    return "sem dados de mercado no momento";
  }
}

export async function chatWithJarvis(messages: ChatMessage[]): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY não configurada.");
  }
  const client = new Anthropic();
  const snapshot = await marketSnapshot();

  const system = [
    "Você é o Jarvis, o assistente de inteligência da Quad₿lock Capital — parceiro de mesa dos três sócios.",
    "Personalidade: confiante, direto, levemente espirituoso (no estilo do assistente do Homem de Ferro), mas sempre profissional e honesto sobre risco.",
    "Fale em português do Brasil. Respostas CURTAS e conversacionais (2-4 frases), como quem fala em voz alta — evite listas longas e jargão desnecessário.",
    "Você acompanha cripto e ações (foco em quântica e IA). Pode comentar mercado, explicar conceitos, e orientar o uso do app (Dashboard, Mercado, Ações, Simulador, análise por moeda).",
    "Nunca dê recomendação financeira definitiva nem prometa lucro; fale em termos de cenários e risco. Se sugerir uma ação, lembre que a decisão e a execução são dos sócios.",
    `Contexto de mercado agora: ${snapshot}.`,
  ].join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    thinking: { type: "disabled" },
    messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
  });

  if (response.stop_reason === "refusal") return "Prefiro não responder isso. Posso ajudar com análise de mercado, moedas ou o app.";
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? text.text : "Não consegui formular uma resposta agora.";
}
