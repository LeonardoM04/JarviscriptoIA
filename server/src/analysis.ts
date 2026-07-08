// Jarvis gênio — análise profunda sob demanda.
// Reúne: multi-timeframe, indicadores, padrões, níveis, derivativos (funding/OI),
// dominância do mercado, notícias recentes, Medo & Ganância, fundamentos da moeda
// e (opcional) a IMAGEM do gráfico para o Claude enxergar o formato do preço.

import Anthropic from "@anthropic-ai/sdk";
import { getKlines, getTicker, getFearGreed, type Candle } from "./bybit.js";
import { getDerivatives } from "./derivatives.js";
import { getGlobal, symbolToId, getCoinDetail } from "./coingecko.js";
import { getNews } from "./news.js";
import { computeIndicators, findLevels } from "./indicators.js";
import { detectPatterns } from "./patterns.js";
import { jarvisScore } from "./score.js";
import { detectStructures } from "./structures.js";
import { getStockChart, getStockNews } from "./stocks.js";

const MODEL = "claude-opus-4-8";

const TIMEFRAMES: { interval: string; label: string }[] = [
  { interval: "60", label: "1 hora" },
  { interval: "240", label: "4 horas" },
  { interval: "D", label: "diário" },
];

const last = <T>(arr: (T | null)[]): T | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};
const fmt = (v: number | null, d = 2) => (v === null ? "N/A" : v.toFixed(d));

function timeframeSummary(label: string, candles: Candle[]): string {
  const ind = computeIndicators(candles);
  const levels = findLevels(candles);
  const price = candles[candles.length - 1].close;
  const rsi = last(ind.rsi14);
  const macdV = last(ind.macd.macd);
  const macdS = last(ind.macd.signal);
  const macdH = last(ind.macd.histogram);
  const ema21 = last(ind.ema21);
  const ema50 = last(ind.ema50);
  const ema200 = last(ind.ema200);

  // divergência simples: preço faz novo topo/fundo mas RSI não acompanha
  const closes = candles.map((c) => c.close);
  const rsiArr = ind.rsi14;
  let divergence = "sem divergência clara";
  const n = closes.length;
  if (n > 20) {
    const priceUp = closes[n - 1] > closes[n - 10];
    const rsiNow = last(rsiArr);
    const rsiPrev = rsiArr[n - 10];
    if (rsiNow !== null && rsiPrev !== null) {
      if (priceUp && rsiNow < rsiPrev) divergence = "divergência de BAIXA (preço sobe, RSI enfraquece)";
      if (!priceUp && rsiNow > rsiPrev) divergence = "divergência de ALTA (preço cai, RSI fortalece)";
    }
  }

  const score = jarvisScore(candles);
  const emaPos = (e: number | null, name: string) =>
    e === null ? `${name}: N/A` : `preço ${price > e ? "acima" : "abaixo"} da ${name} (${fmt(e)})`;

  return [
    `### Timeframe ${label} — Score ${score.score}/100 (${score.momentum})`,
    `- Fechamento: ${fmt(price)}`,
    `- RSI(14): ${fmt(rsi)} | ${divergence}`,
    `- MACD: ${fmt(macdV, 4)} / Sinal ${fmt(macdS, 4)} / Histograma ${fmt(macdH, 4)}`,
    `- Médias: ${emaPos(ema21, "EMA 21")}; ${emaPos(ema50, "EMA 50")}; ${emaPos(ema200, "EMA 200")}`,
    `- Suportes: ${levels.supports.map((v) => fmt(v)).join(", ") || "n/d"}`,
    `- Resistências: ${levels.resistances.map((v) => fmt(v)).join(", ") || "n/d"}`,
    `- Padrões recentes: ${detectPatterns(candles.slice(-25)).slice(-5).map((p) => p.name).join(", ") || "nenhum"}`,
  ].join("\n");
}

const SCHEMA = {
  type: "object",
  properties: {
    veredito: { type: "string", description: "Uma frase direta: o que o preço está dizendo agora" },
    tendencia: { type: "string", enum: ["alta", "baixa", "lateral"] },
    forca_tendencia: { type: "string", enum: ["fraca", "moderada", "forte"] },
    confluencia: { type: "string", description: "Onde os timeframes concordam ou divergem, e o que o gráfico mostra visualmente" },
    leitura_de_ciclo: { type: "string", description: "Fase do ciclo de mercado (acumulação/alta/distribuição/depressão), sinais de possível reversão ou finalização de ciclo, estruturas visíveis (canal, diamante, lateralidade) e, se for BTC, contexto do halving" },
    tese: { type: "string", description: "A tese principal em 2-3 frases" },
    invalidacao: { type: "string", description: "O que precisaria acontecer para a tese estar errada" },
    sinais_alta: { type: "array", items: { type: "string" } },
    sinais_baixa: { type: "array", items: { type: "string" } },
    derivativos_leitura: { type: "string", description: "Leitura do funding rate e open interest (posicionamento do mercado)" },
    noticias_impacto: { type: "string", description: "Como as notícias recentes afetam o cenário, se relevantes" },
    plano: {
      type: "object",
      properties: {
        zona_entrada: { type: "string", description: "Faixa de preço para entrada, ou 'aguardar' com condição" },
        alvos: { type: "array", items: { type: "number" } },
        stop: { type: "number" },
        tamanho_sugerido: { type: "string", description: "Ex.: 'pequena (1-3% da carteira)' — sempre conservador" },
        horizonte: { type: "string", enum: ["curto (dias)", "médio (semanas)", "longo (meses)"] },
      },
      required: ["zona_entrada", "alvos", "stop", "tamanho_sugerido", "horizonte"],
      additionalProperties: false,
    },
    riscos: { type: "array", items: { type: "string" } },
    recomendacao: { type: "string", enum: ["comprar", "acumular gradual", "aguardar", "reduzir", "vender"] },
    confianca: { type: "number", description: "0 a 100, calibrada e honesta" },
  },
  required: [
    "veredito", "tendencia", "forca_tendencia", "confluencia", "leitura_de_ciclo", "tese", "invalidacao",
    "sinais_alta", "sinais_baixa", "derivativos_leitura", "noticias_impacto",
    "plano", "riscos", "recomendacao", "confianca",
  ],
  additionalProperties: false,
} as const;

export interface AnalyzeOptions {
  chartImageBase64?: string; // PNG sem o prefixo data:
}

export async function analyzeSymbol(symbol: string, opts: AnalyzeOptions = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Copie server/.env.example para server/.env e adicione sua chave."
    );
  }
  const client = new Anthropic();
  const base = symbol.replace(/USDT$/, "");

  const [ticker, fearGreed, global, deriv, frames, coinId] = await Promise.all([
    getTicker(symbol),
    getFearGreed(),
    getGlobal().catch(() => null),
    getDerivatives(symbol),
    Promise.all(TIMEFRAMES.map((tf) => getKlines(symbol, tf.interval, 300))),
    symbolToId(symbol).catch(() => null),
  ]);

  const [news, coinDetail] = await Promise.all([
    getNews(base).catch(() => []),
    coinId ? getCoinDetail(coinId).catch(() => null) : Promise.resolve(null),
  ]);

  const summaries = TIMEFRAMES.map((tf, i) => timeframeSummary(tf.label, frames[i])).join("\n\n");
  const newsLines = news.slice(0, 8)
    .map((nItem) => `- [${nItem.sentiment}] ${nItem.title} (${nItem.source})`)
    .join("\n") || "- sem notícias relevantes coletadas";

  const struct = detectStructures(frames[2], symbol);
  const halvingHint = struct.halvings.length ? ` | halving relevante no histórico recente` : ``;
  const contextText = [
    `Você é o Jarvis, um analista técnico de criptomoedas de elite. Faça a análise mais precisa e honesta possível de ${symbol}.`,
    `Pense como gestor de risco: primeiro o que pode dar errado, depois a oportunidade. Nunca prometa lucro. Seja específico com números.`,
    ``,
    `## Contexto de mercado`,
    `- Preço atual: ${ticker.lastPrice} | 24h: ${ticker.price24hPcnt.toFixed(2)}% | Máx/Mín 24h: ${ticker.highPrice24h}/${ticker.lowPrice24h}`,
    fearGreed ? `- Medo & Ganância: ${fearGreed.value} (${fearGreed.label})` : ``,
    global ? `- Dominância BTC: ${global.btcDominance.toFixed(1)}% | Mercado total 24h: ${global.marketCapChange24h.toFixed(2)}%` : ``,
    deriv.available
      ? `- Derivativos (posicionamento dos grandes players): funding ${fmt(deriv.fundingRate, 4)}% | open interest ${deriv.oiTrend ?? "n/d"} (${fmt(deriv.openInterestValueUsd, 0)} USD)` +
        (deriv.buyRatio != null ? ` | contas long/short ${(deriv.buyRatio * 100).toFixed(0)}%/${((deriv.sellRatio ?? 0) * 100).toFixed(0)}%` : ``)
      : `- Derivativos: indisponíveis`,
    coinDetail ? `- Fundamentos: rank #${coinDetail.marketCapRank ?? "?"} | categorias: ${coinDetail.categories.join(", ") || "n/d"} | vs topo histórico: ${fmt(coinDetail.athChangePct)}%` : ``,
    `- Leitura estrutural (heurística) do diário: fase de ciclo aparente = ${struct.cycle.phase}${halvingHint}`,
    ``,
    `## Análise técnica por timeframe`,
    summaries,
    ``,
    `## Notícias recentes`,
    newsLines,
    ``,
    `## Instruções`,
    `- Priorize CONFLUÊNCIA entre 1h, 4h e diário — sinais alinhados nos três valem muito mais.`,
    `- Cruze o técnico com derivativos: funding muito positivo + OI subindo = mercado esticado/risco de correção; proporção long/short muito desequilibrada costuma ser contra-indicador (excesso de longs = combustível para liquidação). Interprete isso como posicionamento das baleias/grandes players.`,
    opts.chartImageBase64 ? `- Você recebeu a IMAGEM do gráfico. USE-A: descreva o formato do preço (topos/fundos, linhas de tendência, rompimentos) que os números sozinhos não capturam.` : ``,
    `- Em 'leitura_de_ciclo': avalie a fase do ciclo (acumulação/alta/distribuição/depressão), sinais de possível reversão ou finalização de ciclo, estruturas visíveis (canal, diamante/lateralidade) e — se for BTC — o contexto do halving. A heurística acima é só um ponto de partida; conclua pelos dados.`,
    `- No plano, dê números concretos (entrada, alvos, stop) coerentes com o preço atual de ${ticker.lastPrice}.`,
    `- Tamanho de posição sempre conservador. Responda em português.`,
  ].filter(Boolean).join("\n");

  const content: Anthropic.ContentBlockParam[] = [];
  if (opts.chartImageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: opts.chartImageBase64 },
    });
  }
  content.push({ type: "text", text: contextText });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 20000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "xhigh",
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("A análise foi recusada pelo modelo. Tente novamente.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Resposta inesperada do modelo.");

  const score = jarvisScore(frames[2]); // score do diário como referência principal

  return {
    symbol,
    ticker,
    fearGreed,
    derivatives: deriv,
    global,
    coinDetail,
    news: news.slice(0, 8),
    score,
    usedVision: Boolean(opts.chartImageBase64),
    analysis: JSON.parse(textBlock.text),
    generatedAt: new Date().toISOString(),
  };
}

// ---------- Análise de AÇÕES (mesmo motor, contexto de bolsa) ----------

const STOCK_TIMEFRAMES: { interval: string; label: string }[] = [
  { interval: "60", label: "1 hora" },
  { interval: "D", label: "diário" },
  { interval: "W", label: "semanal" },
];

export async function analyzeStock(symbol: string, opts: AnalyzeOptions = {}) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY não configurada. Copie server/.env.example para server/.env e adicione sua chave."
    );
  }
  const client = new Anthropic();
  const sym = symbol.toUpperCase();

  const [charts, stockNews] = await Promise.all([
    Promise.all(STOCK_TIMEFRAMES.map((tf) => getStockChart(sym, tf.interval))),
    getStockNews(sym).catch(() => []),
  ]);
  const frames = charts.map((c) => c.candles);
  const quote = charts[1]; // diário traz o preço de referência

  const summaries = STOCK_TIMEFRAMES.map((tf, i) => timeframeSummary(tf.label, frames[i])).join("\n\n");
  const newsLines = stockNews.slice(0, 8).map((n) => `- ${n.title} (${n.source})`).join("\n") ||
    "- sem notícias relevantes coletadas";
  const struct = detectStructures(frames[1], sym);

  const contextText = [
    `Você é o Jarvis, analista de elite de AÇÕES (mercado de bolsa americano). Faça a análise mais precisa e honesta possível de ${sym}.`,
    `Pense como gestor de risco: primeiro o que pode dar errado, depois a oportunidade. Nunca prometa lucro. Seja específico com números.`,
    ``,
    `## Contexto`,
    `- Preço atual: ${quote.price} ${quote.currency} | variação do dia: ${quote.changePct.toFixed(2)}%`,
    `- Leitura estrutural (heurística) do diário: fase de ciclo aparente = ${struct.cycle.phase}`,
    ``,
    `## Análise técnica por timeframe`,
    summaries,
    ``,
    `## Notícias recentes sobre a empresa`,
    newsLines,
    ``,
    `## Instruções`,
    `- Priorize CONFLUÊNCIA entre 1h, diário e semanal.`,
    `- Ações não têm funding/open interest: em 'derivativos_leitura' comente volume e participação institucional aparente, ou diga que não se aplica.`,
    `- Considere o contexto do setor (quântica/IA/semicondutores/cripto na bolsa) e o peso das notícias em 'noticias_impacto'.`,
    `- Em 'leitura_de_ciclo': fase do ciclo, sinais de reversão/finalização, estruturas (canal, lateralidade, diamante).`,
    opts.chartImageBase64 ? `- Você recebeu a IMAGEM do gráfico. USE-A: descreva o formato do preço que os números não capturam.` : ``,
    `- No plano, dê números concretos coerentes com o preço atual de ${quote.price}. Lembre que ações negociam em horário de pregão.`,
    `- Tamanho de posição sempre conservador. Responda em português.`,
  ].filter(Boolean).join("\n");

  const content: Anthropic.ContentBlockParam[] = [];
  if (opts.chartImageBase64) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: "image/png", data: opts.chartImageBase64 },
    });
  }
  content.push({ type: "text", text: contextText });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 20000,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "xhigh",
      format: { type: "json_schema", schema: SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("A análise foi recusada pelo modelo. Tente novamente.");
  }
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Resposta inesperada do modelo.");

  return {
    symbol: sym,
    ticker: {
      lastPrice: quote.price,
      price24hPcnt: quote.changePct,
      highPrice24h: quote.price,
      lowPrice24h: quote.price,
      volume24h: 0,
    },
    fearGreed: null,
    derivatives: { available: false, fundingRate: null, openInterest: null, openInterestValueUsd: null, oiTrend: null, buyRatio: null, sellRatio: null },
    global: null,
    coinDetail: null,
    news: stockNews.slice(0, 8).map((n) => ({ ...n, currencies: [], sentiment: "neutro" as const })),
    score: jarvisScore(frames[1]),
    usedVision: Boolean(opts.chartImageBase64),
    analysis: JSON.parse(textBlock.text),
    generatedAt: new Date().toISOString(),
  };
}
