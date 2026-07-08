// Simulador de trades (paper trading) — cálculos de posição/risco e
// armazenamento local das operações simuladas. Nada aqui toca dinheiro real.

export type Direction = "long" | "short";

export interface SimInputs {
  symbol: string;
  direction: Direction;
  entry: number;
  margin: number; // USD que você "coloca"
  leverage: number;
  target: number; // preço de alvo (take profit)
  stop: number; // preço de stop loss
}

export interface SimMetrics {
  notional: number; // tamanho da posição = margem × alavancagem
  qty: number; // quantidade na moeda base
  targetPnl: number;
  targetRoi: number; // % sobre a margem
  targetMovePct: number; // % de movimento do preço até o alvo
  stopPnl: number; // negativo
  stopRoi: number;
  stopMovePct: number;
  riskReward: number;
  liquidation: number;
  warning?: string;
}

// margem de manutenção aproximada (varia por corretora/par); usada só na estimativa
const MMR = 0.005;

export function computeMetrics(i: SimInputs): SimMetrics {
  const notional = i.margin * i.leverage;
  const qty = i.entry > 0 ? notional / i.entry : 0;
  const dir = i.direction === "long" ? 1 : -1;
  const pnlAt = (price: number) => qty * (price - i.entry) * dir;

  const targetPnl = pnlAt(i.target);
  const stopPnl = pnlAt(i.stop);
  const liquidation =
    i.direction === "long"
      ? i.entry * (1 - 1 / i.leverage + MMR)
      : i.entry * (1 + 1 / i.leverage - MMR);
  const riskReward = stopPnl !== 0 ? Math.abs(targetPnl / stopPnl) : 0;

  let warning: string | undefined;
  if (i.direction === "long" && !(i.target > i.entry && i.stop < i.entry)) {
    warning = "Para LONG: alvo acima e stop abaixo da entrada.";
  }
  if (i.direction === "short" && !(i.target < i.entry && i.stop > i.entry)) {
    warning = "Para SHORT: alvo abaixo e stop acima da entrada.";
  }

  return {
    notional,
    qty,
    targetPnl,
    targetRoi: i.margin ? (targetPnl / i.margin) * 100 : 0,
    targetMovePct: i.entry ? ((i.target - i.entry) / i.entry) * 100 : 0,
    stopPnl,
    stopRoi: i.margin ? (stopPnl / i.margin) * 100 : 0,
    stopMovePct: i.entry ? ((i.stop - i.entry) / i.entry) * 100 : 0,
    riskReward,
    liquidation,
    warning,
  };
}

// P/L de uma posição aberta contra o preço atual
export function livePnl(p: PaperPosition, price: number): { pnl: number; roi: number } {
  const dir = p.direction === "long" ? 1 : -1;
  const pnl = p.qty * (price - p.entry) * dir;
  return { pnl, roi: p.margin ? (pnl / p.margin) * 100 : 0 };
}

// ---- armazenamento local (por navegador) ----
export type AssetType = "cripto" | "acao";

export interface PaperPosition {
  id: string;
  symbol: string;
  assetType?: AssetType; // posições antigas (sem o campo) são cripto
  direction: Direction;
  entry: number;
  margin: number;
  leverage: number;
  target: number;
  stop: number;
  qty: number;
  liquidation: number;
  openedAt: string;
  status: "aberta" | "fechada";
  closePrice?: number;
  closedAt?: string;
  realizedPnl?: number;
}

const KEY = "jarvis_sim_positions";

export function loadPositions(): PaperPosition[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePositions(list: PaperPosition[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
}
