import { useEffect, useRef, useState } from "react";
import { fetchTicker, fetchKlines, fetchStock } from "../api";
import { loadAlerts, saveAlerts, evalAlert, notify, describeAlert, type Alert } from "../alerts";

interface Toast { id: string; title: string; body: string; }

const lastRsi = (arr: (number | null)[]): number | null => {
  for (let i = arr.length - 1; i >= 0; i--) if (arr[i] !== null) return arr[i];
  return null;
};

// busca preço + variação + rsi de um ativo (só o necessário)
async function assetData(symbol: string, type: "cripto" | "acao", needRsi: boolean) {
  if (type === "acao") {
    const s = await fetchStock(symbol, "D");
    return { price: s.quote.price, change24h: s.quote.changePct, rsi: needRsi ? lastRsi(s.indicators.rsi14) : null };
  }
  const sym = symbol + "USDT";
  const t = await fetchTicker(sym);
  let rsi: number | null = null;
  if (needRsi) {
    try { rsi = lastRsi((await fetchKlines(sym, "D", 200)).indicators.rsi14); } catch { /* ignora */ }
  }
  return { price: t.ticker.lastPrice, change24h: t.ticker.price24hPcnt, rsi };
}

export default function AlertsWatcher() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const checking = useRef(false);

  // recebe os disparos e mostra toast
  useEffect(() => {
    const onAlert = (e: Event) => {
      const { title, body } = (e as CustomEvent).detail;
      const id = Math.random().toString(36).slice(2);
      setToasts((t) => [...t, { id, title, body }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000);
    };
    window.addEventListener("jarvis-alert", onAlert);
    return () => window.removeEventListener("jarvis-alert", onAlert);
  }, []);

  // laço de verificação enquanto o app está aberto
  useEffect(() => {
    const check = async () => {
      if (checking.current) return;
      const alerts = loadAlerts().filter((a) => !a.triggered);
      if (!alerts.length) return;
      checking.current = true;
      try {
        // agrupa por ativo pra buscar dados uma vez só
        const groups = new Map<string, Alert[]>();
        for (const a of alerts) groups.set(`${a.type}:${a.symbol}`, [...(groups.get(`${a.type}:${a.symbol}`) || []), a]);

        const fired: Record<string, string> = {}; // id -> horário
        await Promise.all([...groups.values()].map(async (group) => {
          const { symbol, type } = group[0];
          const needRsi = group.some((a) => a.metric === "rsi");
          try {
            const data = await assetData(symbol, type, needRsi);
            for (const a of group) {
              if (evalAlert(a, data)) {
                fired[a.id] = new Date().toISOString();
                notify("🔔 Alerta do Jarvis", describeAlert(a));
              }
            }
          } catch { /* ativo indisponível agora */ }
        }));

        if (Object.keys(fired).length) {
          const updated = loadAlerts().map((a) => (fired[a.id] ? { ...a, triggered: true, triggeredAt: fired[a.id] } : a));
          saveAlerts(updated);
        }
      } finally {
        checking.current = false;
      }
    };
    check();
    const id = setInterval(check, 60000);
    return () => clearInterval(id);
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div key={t.id} className="toast" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
          <div className="toast-title">{t.title}</div>
          <div className="toast-body">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
