import { useEffect, useRef, useState } from "react";
import { fetchAlerts } from "../api";
import { describeAlert } from "../alerts";

interface Toast { id: string; title: string; body: string; }

// Feedback in-app dos alertas. A avaliação/disparo é no SERVIDOR; aqui só
// mostramos um toast quando (a) chega um push com o app aberto, ou (b) o poll
// percebe um alerta recém-disparado. Notificação de sistema vem do push.
export default function AlertsWatcher() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seen = useRef<Set<string> | null>(null);

  const pushToast = (title: string, body: string) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 12000);
  };

  // toast vindo do service worker (push recebido com o app aberto)
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === "alert-push") pushToast(e.data.title || "🔔 Alerta", e.data.body || "");
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, []);

  // poll leve: avisa quando um alerta vira "disparado" (cobre quem não deu push)
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const { alerts } = await fetchAlerts();
        const triggered = alerts.filter((a) => a.triggered);
        if (seen.current === null) {
          // primeira leitura: memoriza os já disparados sem re-notificar
          seen.current = new Set(triggered.map((a) => a.id));
          return;
        }
        for (const a of triggered) {
          if (!seen.current.has(a.id)) {
            seen.current.add(a.id);
            if (active) pushToast("🔔 Alerta Quad₿lock", describeAlert(a));
          }
        }
      } catch { /* offline / sem servidor agora */ }
    };
    poll();
    const id = setInterval(poll, 60000);
    return () => { active = false; clearInterval(id); };
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
