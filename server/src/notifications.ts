// Push real: chaves VAPID, envio de Web Push, avaliação dos alertas no
// servidor (funciona com o app fechado) e o agendador periódico.

import webpush from "web-push";
import { alertRepo, type Alert, type AssetType, type Metric } from "./alerts-store.js";
import { getTicker, getKlines } from "./bybit.js";
import { getStockChart } from "./stocks.js";
import { computeIndicators } from "./indicators.js";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:jarvis@quadblock.app";

let vapidReady: Promise<{ publicKey: string; privateKey: string }> | null = null;

// chaves fixas por env (recomendado em produção) ou geradas/persistidas no store
export function getVapid() {
  if (!vapidReady) {
    vapidReady = (async () => {
      let publicKey = process.env.VAPID_PUBLIC_KEY || "";
      let privateKey = process.env.VAPID_PRIVATE_KEY || "";
      if (!publicKey || !privateKey) {
        publicKey = (await alertRepo.getKv("vapidPublic")) || "";
        privateKey = (await alertRepo.getKv("vapidPrivate")) || "";
      }
      if (!publicKey || !privateKey) {
        const keys = webpush.generateVAPIDKeys();
        publicKey = keys.publicKey; privateKey = keys.privateKey;
        await alertRepo.setKv("vapidPublic", publicKey);
        await alertRepo.setKv("vapidPrivate", privateKey);
      }
      webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
      return { publicKey, privateKey };
    })();
  }
  return vapidReady;
}

export async function getVapidPublicKey(): Promise<string> {
  return (await getVapid()).publicKey;
}

const lastValid = (arr: (number | null)[]): number | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};

interface AssetSnapshot { price: number; change24h: number | null; rsi: number | null; }

async function assetData(symbol: string, type: AssetType, needRsi: boolean): Promise<AssetSnapshot> {
  if (type === "acao") {
    const c = await getStockChart(symbol, "D");
    const rsi = needRsi ? lastValid(computeIndicators(c.candles).rsi14) : null;
    return { price: c.price, change24h: c.changePct, rsi };
  }
  const sym = symbol + "USDT";
  const t = await getTicker(sym);
  let rsi: number | null = null;
  if (needRsi) {
    try { rsi = lastValid(computeIndicators(await getKlines(sym, "D", 200)).rsi14); } catch { /* ignora */ }
  }
  return { price: t.lastPrice, change24h: t.price24hPcnt, rsi };
}

function currentMetric(metric: Metric, d: AssetSnapshot): number | null {
  if (metric === "preco") return d.price;
  if (metric === "variacao24h") return d.change24h;
  return d.rsi;
}

function fired(a: Alert, d: AssetSnapshot): boolean {
  const current = currentMetric(a.metric, d);
  if (current === null || !Number.isFinite(current)) return false;
  return a.op === ">=" ? current >= a.value : current <= a.value;
}

const metricLabel: Record<Metric, string> = { preco: "Preço", variacao24h: "Variação 24h", rsi: "RSI" };
export function describeAlert(a: Alert): string {
  const unit = a.metric === "preco" ? "$" : a.metric === "variacao24h" ? "%" : "";
  const opTxt = a.op === ">=" ? "atingiu/passou de" : "caiu para/abaixo de";
  const val = a.metric === "preco" ? a.value.toLocaleString("pt-BR") : a.value;
  return `${a.symbol} — ${metricLabel[a.metric]} ${opTxt} ${unit}${val}`;
}

// envia um push pra todos os aparelhos inscritos; remove inscrições mortas
export async function pushToAll(payload: { title: string; body: string; url?: string; tag?: string }) {
  await getVapid();
  const subs = await alertRepo.getSubs();
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload)
      );
    } catch (err: any) {
      const code = err?.statusCode;
      if (code === 404 || code === 410) await alertRepo.removeSub(s.endpoint);
    }
  }));
}

let checking = false;

// avalia todos os alertas ativos; dispara push nos que bateram. Retorna quantos.
export async function checkAlerts(): Promise<number> {
  if (checking) return 0;
  checking = true;
  try {
    const alerts = (await alertRepo.getAlerts()).filter((a) => !a.triggered);
    if (!alerts.length) return 0;

    const groups = new Map<string, Alert[]>();
    for (const a of alerts) {
      const k = `${a.assetType}:${a.symbol}`;
      groups.set(k, [...(groups.get(k) || []), a]);
    }

    let count = 0;
    await Promise.all([...groups.values()].map(async (group) => {
      const { symbol, assetType } = group[0];
      const needRsi = group.some((a) => a.metric === "rsi");
      let data: AssetSnapshot;
      try { data = await assetData(symbol, assetType, needRsi); } catch { return; }
      for (const a of group) {
        if (fired(a, data)) {
          await alertRepo.setTriggered(a.id, new Date().toISOString());
          count++;
          await pushToAll({ title: "🔔 Alerta Quad₿lock", body: describeAlert(a), url: "/alertas" });
        }
      }
    }));
    return count;
  } finally {
    checking = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;
export function startAlertScheduler(intervalMs = 60_000) {
  if (timer) return;
  // primeira checagem logo após subir, depois periódica
  checkAlerts().catch(() => {});
  timer = setInterval(() => { checkAlerts().catch(() => {}); }, intervalMs);
}
