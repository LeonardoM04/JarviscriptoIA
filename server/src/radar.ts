// Radar do Jarvis — notificações PROATIVAS além dos alertas marcados.
// Periodicamente varre as moedas principais, o clima do mercado (Medo &
// Ganância) e as notícias; quando algo relevante aparece, o Jarvis escreve
// um aviso curto e dispara um push. Tudo com dedupe/cooldown pra não encher.

import Anthropic from "@anthropic-ai/sdk";
import { alertRepo } from "./alerts-store.js";
import { getMarkets, getGlobal, type MarketCoin } from "./coingecko.js";
import { getFearGreed } from "./bybit.js";
import { getNews, type NewsItem } from "./news.js";
import { pushToAll } from "./notifications.js";

const MODEL = "claude-opus-4-8";

// ---- estado (dedupe): guarda quando cada sinal foi enviado + URLs de notícias
interface RadarState {
  sent: Record<string, string>; // chave do sinal -> ISO do último envio
  newsUrls: string[]; // últimas notícias já avisadas (evita repetir)
}

async function loadState(): Promise<RadarState> {
  try {
    const raw = await alertRepo.getKv("radarState");
    if (raw) {
      const d = JSON.parse(raw);
      return { sent: d.sent || {}, newsUrls: d.newsUrls || [] };
    }
  } catch { /* estado novo */ }
  return { sent: {}, newsUrls: [] };
}

async function saveState(s: RadarState) {
  // poda sinais com mais de 48h e mantém só as últimas 200 URLs
  const cutoff = Date.now() - 48 * 3600_000;
  const sent: Record<string, string> = {};
  for (const [k, v] of Object.entries(s.sent)) {
    if (new Date(v).getTime() >= cutoff) sent[k] = v;
  }
  await alertRepo.setKv("radarState", JSON.stringify({ sent, newsUrls: s.newsUrls.slice(-200) }));
}

const onCooldown = (s: RadarState, key: string, hours: number): boolean => {
  const last = s.sent[key];
  return !!last && Date.now() - new Date(last).getTime() < hours * 3600_000;
};

// ---- sinais candidatos ----
interface Signal {
  key: string; // identidade p/ dedupe
  cooldownH: number; // horas de silêncio após enviar
  priority: number; // maior = mais importante
  title: string; // título do push
  url: string; // p/ onde a notificação leva
  context: string; // fato cru; o Jarvis transforma em frase
  fallback: string; // mensagem se não houver IA
}

const money = (v: number) =>
  "$" + v.toLocaleString("en-US", { maximumFractionDigits: v < 1 ? 4 : v < 100 ? 2 : 0 });

function marketSignals(markets: MarketCoin[], fg: { value: number; label: string } | null): Signal[] {
  const out: Signal[] = [];
  const top = markets.slice(0, 15);

  for (const m of top) {
    const sym = m.symbol.toUpperCase();
    const isBig = sym === "BTC" || sym === "ETH"; // essas moedas mexem menos
    const c24 = m.price_change_percentage_24h;
    const c1 = m.price_change_percentage_1h;

    // pico rápido (1h) — mais urgente
    if (c1 != null && Math.abs(c1) >= (isBig ? 3 : 5)) {
      const dir = c1 >= 0 ? "disparou" : "despencou";
      out.push({
        key: `spike:${sym}`, cooldownH: 4, priority: 3,
        title: "🧠 Jarvis", url: `/moeda/${sym}`,
        context: `${m.name} (${sym}) ${dir} ${c1.toFixed(1)}% na última HORA — agora em ${money(m.current_price)}. Movimento rápido.`,
        fallback: `${sym} ${dir} ${c1.toFixed(1)}% na última hora — ${money(m.current_price)}.`,
      });
      continue; // se teve pico, não duplica com o de 24h
    }

    // movimento forte no dia
    if (c24 != null && Math.abs(c24) >= (isBig ? 6 : 9)) {
      const dir = c24 >= 0 ? "subiu" : "caiu";
      out.push({
        key: `move:${sym}`, cooldownH: 8, priority: 2,
        title: "🧠 Jarvis", url: `/moeda/${sym}`,
        context: `${m.name} (${sym}) ${dir} ${c24.toFixed(1)}% em 24h — agora em ${money(m.current_price)}.`,
        fallback: `${sym} ${dir} ${c24.toFixed(1)}% em 24h — ${money(m.current_price)}.`,
      });
    }
  }

  // extremo de Medo & Ganância
  if (fg && Number.isFinite(fg.value)) {
    if (fg.value <= 20) {
      out.push({
        key: "fg:extreme-fear", cooldownH: 12, priority: 4,
        title: "🧠 Jarvis", url: "/",
        context: `Índice de Medo & Ganância em ${fg.value} — MEDO EXTREMO. Historicamente zonas assim marcam pânico do varejo.`,
        fallback: `Medo & Ganância em ${fg.value}: medo extremo no mercado.`,
      });
    } else if (fg.value >= 80) {
      out.push({
        key: "fg:extreme-greed", cooldownH: 12, priority: 4,
        title: "🧠 Jarvis", url: "/",
        context: `Índice de Medo & Ganância em ${fg.value} — GANÂNCIA EXTREMA. Euforia costuma pedir cautela.`,
        fallback: `Medo & Ganância em ${fg.value}: ganância extrema no mercado.`,
      });
    }
  }

  return out;
}

// notícia de alto impacto: sentimento forte + moeda principal OU palavra-chave pesada
const HIGH_IMPACT = /\b(hack|exploit|ban|banned|sec\b|lawsuit|sued|etf|approv|halving|fed|rate cut|rate hike|regulat|delist|bankrupt|liquidat|all-time high|record high)\b/i;

function newsSignals(news: NewsItem[], majors: Set<string>, state: RadarState): Signal[] {
  const out: Signal[] = [];
  const fresh = Date.now() - 60 * 60_000; // últimos 60 min

  for (const n of news) {
    if (!n.url || state.newsUrls.includes(n.url)) continue;
    const when = new Date(n.publishedAt).getTime();
    if (!Number.isFinite(when) || when < fresh) continue;

    const mentionsMajor = n.currencies.some((c) => majors.has(c.toUpperCase()));
    const strong = n.sentiment !== "neutro";
    const heavy = HIGH_IMPACT.test(n.title);
    if (!heavy && !(strong && mentionsMajor)) continue;

    const tag = n.sentiment === "positivo" ? "📈" : n.sentiment === "negativo" ? "⚠️" : "📰";
    out.push({
      key: `news:${n.url}`, cooldownH: 9999, priority: heavy ? 3 : 2,
      title: "📰 Jarvis", url: "/noticias",
      context: `Notícia (${n.source}, tom ${n.sentiment}): "${n.title}". Explique em 1 frase por que importa pro mercado cripto.`,
      fallback: `${tag} ${n.source}: ${n.title}`,
    });
  }
  return out;
}

// ---- o Jarvis escreve a frase do push ----
async function jarvisWrite(sig: Signal): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) return sig.fallback;
  try {
    const client = new Anthropic();
    const system = [
      "Você é o Jarvis, o assistente de inteligência da Quad₿lock Capital.",
      "Escreva UM aviso curtíssimo para uma notificação push (máximo ~140 caracteres, 1 frase).",
      "Tom confiante, direto e levemente espirituoso (estilo do assistente do Homem de Ferro). Português do Brasil.",
      "Nunca recomende comprar ou vender; aponte o fato e o que observar. Sem aspas, sem emojis, sem 'Jarvis:'.",
    ].join("\n");
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 120,
      system,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: sig.context }],
    });
    const t = r.content.find((b) => b.type === "text");
    const text = t && t.type === "text" ? t.text.trim().replace(/^["']|["']$/g, "") : "";
    return text || sig.fallback;
  } catch {
    return sig.fallback;
  }
}

let running = false;

// Varre o mercado e dispara os avisos novos. Retorna quantos foram enviados.
export async function runRadar(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    // sem ninguém inscrito, não há pra quem avisar
    const subs = await alertRepo.getSubs();
    if (!subs.length) return 0;

    const state = await loadState();
    const [markets, fg] = await Promise.all([
      getMarkets(50, 1).catch(() => [] as MarketCoin[]),
      getFearGreed().catch(() => null),
    ]);
    const majors = new Set(markets.slice(0, 15).map((m) => m.symbol.toUpperCase()));
    const news = await getNews().catch(() => [] as NewsItem[]);

    let candidates = [
      ...marketSignals(markets, fg),
      ...newsSignals(news, majors, state),
    ];

    // tira o que ainda está em cooldown e ordena por importância
    candidates = candidates
      .filter((s) => !onCooldown(state, s.key, s.cooldownH))
      .sort((a, b) => b.priority - a.priority);

    // no máximo 2 avisos por rodada — nada de spam
    const toSend = candidates.slice(0, 2);
    let count = 0;
    for (const sig of toSend) {
      const body = await jarvisWrite(sig);
      await pushToAll({ title: sig.title, body, url: sig.url, tag: "jarvis-radar" });
      state.sent[sig.key] = new Date().toISOString();
      if (sig.key.startsWith("news:")) state.newsUrls.push(sig.key.slice("news:".length));
      count++;
    }
    if (count) await saveState(state);
    return count;
  } finally {
    running = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startRadarScheduler(intervalMs = 15 * 60_000) {
  if (timer) return;
  // primeira varredura ~20s após subir (deixa o resto iniciar), depois periódica
  setTimeout(() => { runRadar().catch(() => {}); }, 20_000);
  timer = setInterval(() => { runRadar().catch(() => {}); }, intervalMs);
}
