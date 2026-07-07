import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { getKlines, getTicker, getFearGreed } from "./bybit.js";
import { computeIndicators } from "./indicators.js";
import { detectPatterns } from "./patterns.js";
import { jarvisScore } from "./score.js";
import { analyzeSymbol } from "./analysis.js";
import { getMarkets, getGlobal, getCoinDetail, symbolToId } from "./coingecko.js";
import { getDerivatives } from "./derivatives.js";
import { getNews } from "./news.js";

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
  res.json({ symbol, interval, candles, indicators, patterns, score });
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

// ---- notícias ----
app.get("/api/news", handle(async (req, res) => {
  const currency = req.query.symbol ? normalizeSymbol(String(req.query.symbol)).replace(/USDT$/, "") : undefined;
  const news = await getNews(currency);
  res.json({ news });
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
});
