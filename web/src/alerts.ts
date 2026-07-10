// Alertas de mercado — definidos pelo usuário, guardados no navegador.
// O AlertsWatcher checa periodicamente (enquanto o app está aberto) e notifica.

export type AssetType = "cripto" | "acao";
export type Metric = "preco" | "variacao24h" | "rsi";
export type Op = ">=" | "<=";

export interface Alert {
  id: string;
  symbol: string; // BTC (cripto) ou NVDA (ação)
  type: AssetType;
  metric: Metric;
  op: Op;
  value: number;
  createdAt: string;
  triggered?: boolean;
  triggeredAt?: string;
}

const KEY = "jarvis_alerts";

export function loadAlerts(): Alert[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}
export function saveAlerts(list: Alert[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export const metricLabel: Record<Metric, string> = {
  preco: "Preço",
  variacao24h: "Variação 24h",
  rsi: "RSI",
};

export function describeAlert(a: Alert): string {
  const unit = a.metric === "preco" ? "$" : a.metric === "variacao24h" ? "%" : "";
  const opTxt = a.op === ">=" ? "atingir/passar de" : "cair para/abaixo de";
  const val = a.metric === "preco" ? a.value.toLocaleString("pt-BR") : a.value;
  return `${a.symbol} — ${metricLabel[a.metric]} ${opTxt} ${unit}${val}`;
}

// avalia um alerta contra os dados atuais; retorna true se disparou
export function evalAlert(a: Alert, data: { price: number; change24h: number | null; rsi: number | null }): boolean {
  let current: number | null = null;
  if (a.metric === "preco") current = data.price;
  else if (a.metric === "variacao24h") current = data.change24h;
  else if (a.metric === "rsi") current = data.rsi;
  if (current === null || !Number.isFinite(current)) return false;
  return a.op === ">=" ? current >= a.value : current <= a.value;
}

// notificação (navegador + evento in-app para o toast)
export function notify(title: string, body: string) {
  window.dispatchEvent(new CustomEvent("jarvis-alert", { detail: { title, body } }));
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try { new Notification(title, { body }); } catch { /* noop */ }
  }
}

export async function ensureNotifyPermission(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}
