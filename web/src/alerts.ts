// Tipos e formatação dos alertas. A avaliação e o envio de notificações agora
// são no SERVIDOR (funciona com o app fechado) — ver server/notifications.ts.

export type AssetType = "cripto" | "acao";
export type Metric = "preco" | "variacao24h" | "rsi";
export type Op = ">=" | "<=";

export interface Alert {
  id: string;
  symbol: string;
  assetType: AssetType;
  metric: Metric;
  op: Op;
  value: number;
  person?: string;
  createdAt: string;
  triggered?: boolean;
  triggeredAt?: string;
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
