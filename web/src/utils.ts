export const money = (v: number, max = 2) =>
  "$" + v.toLocaleString("pt-BR", { maximumFractionDigits: v < 1 && v > 0 ? 6 : max });

export const pct = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;

export const compact = (v: number) => {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(2)}K`;
  return `$${v.toFixed(0)}`;
};

export const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

export const scoreColor = (score: number) =>
  score >= 62 ? "#2ebd85" : score <= 38 ? "#e04f5f" : "#fbbf24";

export const changeClass = (v: number | null | undefined) =>
  v === null || v === undefined ? "" : v >= 0 ? "up" : "down";
