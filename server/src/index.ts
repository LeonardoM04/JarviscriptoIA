import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getKlines, getTicker, getFearGreed } from "./bybit.js";
import { computeIndicators } from "./indicators.js";
import { detectPatterns } from "./patterns.js";
import { jarvisScore } from "./score.js";
import { detectStructures } from "./structures.js";
import { analyzeSymbol, analyzeStock } from "./analysis.js";
import { getMarkets, getGlobal, getCoinDetail, symbolToId } from "./coingecko.js";
import { getDerivatives } from "./derivatives.js";
import { getNews } from "./news.js";
import { getStockGroups, getStockChart, getStockNews, tickerName } from "./stocks.js";
import { chatWithJarvis, jarvisBriefing, type ChatMessage } from "./chat.js";
import { repo, storageMode, type Tx } from "./store.js";
import { buildPortfolio, analyzePortfolio } from "./portfolio.js";
import { alertRepo, type Alert, type Metric } from "./alerts-store.js";
import { getVapidPublicKey, checkAlerts, startAlertScheduler } from "./notifications.js";

const app = express();
app.use(express.json({ limit: "8mb" }));

const normalizeSymbol = (raw: string) => {
  const s = raw.toUpperCase().trim();
  return s.endsWith("USDT") ? s : `${s}USDT`;
};

const handle = (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
  async (req: express.Request, res: express.Response) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  };

// ---- senha compartilhada ----
// Se APP_PASSWORD estiver definida, todo /api exige o header x-app-password.
// Sem ela (dev local), o app fica aberto.
const APP_PASSWORD = process.env.APP_PASSWORD;
app.use("/api", (req, res, next) => {
  // o cron externo não tem a senha do app — ele se autentica pelo CRON_SECRET
  if (req.path.startsWith("/cron") || req.path.startsWith("/api/cron")) return next();
  if (!APP_PASSWORD) return next();
  if (req.header("x-app-password") === APP_PASSWORD) return next();
  res.status(401).json({ error: "unauthorized" });
});

// valida a senha (usado pela tela de login)
app.get("/api/auth", (_req, res) => res.json({ ok: true }));

// ---- gráfico / técnico ----
app.get("/api/klines", handle(async (req, res) => {
  const symbol = normalizeSymbol(String(req.query.symbol || "BTCUSDT"));
  const interval = String(req.query.interval || "60");
  const limit = Number(req.query.limit || 500);
  const candles = await getKlines(symbol, interval, limit);
  const indicators = computeIndicators(candles);
  const patterns = detectPatterns(candles);
  const score = jarvisScore(candles);
  const structures = detectStructures(candles, symbol);
  res.json({ symbol, interval, candles, indicators, patterns, score, structures });
}));

app.get("/api/ticker", handle(async (req, res) => {
  const symbol = normalizeSymbol(String(req.query.symbol || "BTCUSDT"));
  const [ticker, fearGreed, derivatives] = await Promise.all([
    getTicker(symbol),
    getFearGreed(),
    getDerivatives(symbol),
  ]);
  res.json({ symbol, ticker, fearGreed, derivatives });
}));

// ---- mercado / dashboard ----
app.get("/api/markets", handle(async (_req, res) => {
  const markets = await getMarkets(100, 1);
  res.json({ markets });
}));

app.get("/api/global", handle(async (_req, res) => {
  const [global, fearGreed] = await Promise.all([getGlobal(), getFearGreed()]);
  res.json({ global, fearGreed });
}));

// ---- página da moeda ----
app.get("/api/coin/:symbol", handle(async (req, res) => {
  const symbol = normalizeSymbol(req.params.symbol);
  const base = symbol.replace(/USDT$/, "");
  const id = await symbolToId(symbol).catch(() => null);
  const [detail, news, derivatives] = await Promise.all([
    id ? getCoinDetail(id).catch(() => null) : Promise.resolve(null),
    getNews(base).catch(() => []),
    getDerivatives(symbol),
  ]);
  res.json({ symbol, detail, news, derivatives });
}));

// ---- ações (quântica + IA) ----
app.get("/api/stocks", handle(async (_req, res) => {
  const groups = await getStockGroups();
  res.json({ groups });
}));

app.get("/api/stock/:symbol", handle(async (req, res) => {
  const symbol = String(req.params.symbol).toUpperCase();
  const interval = String(req.query.interval || "D");
  const [chart, news] = await Promise.all([
    getStockChart(symbol, interval),
    getStockNews(symbol).catch(() => []),
  ]);
  const indicators = computeIndicators(chart.candles);
  const patterns = detectPatterns(chart.candles);
  const score = jarvisScore(chart.candles);
  const structures = detectStructures(chart.candles, symbol);
  res.json({
    symbol, interval, name: tickerName(symbol), candles: chart.candles, indicators, patterns, score, structures, news,
    quote: { price: chart.price, changePct: chart.changePct, currency: chart.currency },
  });
}));

app.post("/api/analyze-stock", handle(async (req, res) => {
  const symbol = String(req.body?.symbol || "NVDA").toUpperCase();
  const chartImageBase64 = typeof req.body?.chartImage === "string"
    ? req.body.chartImage.replace(/^data:image\/png;base64,/, "")
    : undefined;
  const result = await analyzeStock(symbol, { chartImageBase64 });
  res.json(result);
}));

// ---- notícias ----
app.get("/api/news", handle(async (req, res) => {
  const currency = req.query.symbol ? normalizeSymbol(String(req.query.symbol)).replace(/USDT$/, "") : undefined;
  const news = await getNews(currency);
  res.json({ news });
}));

// ---- carteira do grupo ----
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

app.get("/api/portfolio", handle(async (_req, res) => {
  const txs = await repo.getAll();
  const data = await buildPortfolio(txs);
  res.json({ ...data, storageMode });
}));

app.post("/api/portfolio/tx", handle(async (req, res) => {
  const b = req.body || {};
  const symbol = String(b.symbol || "").toUpperCase().replace(/USDT$/, "").trim();
  const quantity = Number(b.quantity);
  const price = Number(b.price);
  if (!symbol || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "Dados inválidos (símbolo, quantidade, preço)." });
    return;
  }
  const tx: Tx = {
    id: uid(), symbol,
    assetType: b.assetType === "acao" ? "acao" : "cripto",
    side: b.side === "venda" ? "venda" : "compra",
    quantity, price,
    person: String(b.person || "—").slice(0, 40),
    note: b.note ? String(b.note).slice(0, 200) : undefined,
    // data só-dia (YYYY-MM-DD) vira meio-dia UTC p/ não "voltar um dia" em fusos
    // negativos (Brasil = UTC-3). Sem data informada, usa o agora.
    createdAt: b.date
      ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(b.date)) ? `${b.date}T12:00:00Z` : String(b.date)).toISOString()
      : new Date().toISOString(),
  };
  await repo.add(tx);
  res.json({ ok: true, tx });
}));

app.delete("/api/portfolio/tx/:id", handle(async (req, res) => {
  const ok = await repo.remove(String(req.params.id));
  res.json({ ok });
}));

app.post("/api/portfolio/analyze", handle(async (_req, res) => {
  const analysis = await analyzePortfolio(await repo.getAll());
  res.json({ analysis });
}));

// ---- alertas de mercado (servidor) + Web Push ----
app.get("/api/push/vapid", handle(async (_req, res) => {
  res.json({ publicKey: await getVapidPublicKey() });
}));

app.post("/api/push/subscribe", handle(async (req, res) => {
  const sub = req.body?.subscription || req.body;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    res.status(400).json({ error: "Inscrição de push inválida." });
    return;
  }
  await alertRepo.addSub({
    endpoint: String(sub.endpoint),
    keys: { p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth) },
    createdAt: new Date().toISOString(),
  });
  res.json({ ok: true });
}));

app.post("/api/push/unsubscribe", handle(async (req, res) => {
  const endpoint = req.body?.endpoint;
  res.json({ ok: endpoint ? await alertRepo.removeSub(String(endpoint)) : false });
}));

app.get("/api/alerts", handle(async (_req, res) => {
  res.json({ alerts: await alertRepo.getAlerts() });
}));

app.post("/api/alerts", handle(async (req, res) => {
  const b = req.body || {};
  const symbol = String(b.symbol || "").toUpperCase().replace(/USDT$/, "").trim();
  const value = Number(b.value);
  const metric: Metric = ["preco", "variacao24h", "rsi"].includes(b.metric) ? b.metric : "preco";
  if (!symbol || !Number.isFinite(value)) {
    res.status(400).json({ error: "Dados do alerta inválidos (símbolo/valor)." });
    return;
  }
  const alert: Alert = {
    id: uid(), symbol,
    assetType: b.assetType === "acao" ? "acao" : "cripto",
    metric,
    op: b.op === "<=" ? "<=" : ">=",
    value,
    person: b.person ? String(b.person).slice(0, 40) : undefined,
    createdAt: new Date().toISOString(),
    triggered: false,
  };
  await alertRepo.addAlert(alert);
  res.json({ ok: true, alert });
}));

app.delete("/api/alerts/:id", handle(async (req, res) => {
  res.json({ ok: await alertRepo.removeAlert(String(req.params.id)) });
}));

// cron externo (sem senha do app; protegido pelo CRON_SECRET): acorda o Render
// grátis e roda a checagem dos alertas. Ex.: cron-job.org chama de 5 em 5 min.
app.all("/api/cron/check", handle(async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query.key !== secret) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const fired = await checkAlerts();
  res.json({ ok: true, fired });
}));

// ---- Jarvis conversacional ----
app.get("/api/briefing", handle(async (req, res) => {
  const hour = Number(req.query.hour ?? new Date().getHours());
  const briefing = await jarvisBriefing(Number.isFinite(hour) ? hour : new Date().getHours());
  res.json({ briefing });
}));

app.post("/api/chat", handle(async (req, res) => {
  const messages: ChatMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const { reply, focus } = await chatWithJarvis(messages);
  res.json({ reply, focus });
}));

// ---- análise gênio ----
app.post("/api/analyze", handle(async (req, res) => {
  const symbol = normalizeSymbol(String(req.body?.symbol || "BTCUSDT"));
  const chartImageBase64 = typeof req.body?.chartImage === "string"
    ? req.body.chartImage.replace(/^data:image\/png;base64,/, "")
    : undefined;
  const result = await analyzeSymbol(symbol, { chartImageBase64 });
  res.json(result);
}));

// ---- interface (produção): serve o build do React se existir ----
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../web/dist");
if (fs.existsSync(path.join(webDist, "index.html"))) {
  app.use(express.static(webDist));
  // fallback SPA — qualquer rota que não seja /api devolve o index.html
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "not found" });
    res.sendFile(path.join(webDist, "index.html"));
  });
}

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
  console.log(`Jarvis server rodando em http://localhost:${port}`);
  // vigia os alertas a cada minuto enquanto o servidor está acordado
  startAlertScheduler();
});
