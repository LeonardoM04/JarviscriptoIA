import { useEffect, useState } from "react";
import {
  loadAlerts, saveAlerts, describeAlert, ensureNotifyPermission,
  type Alert, type AssetType, type Metric, type Op,
} from "../alerts";
import { timeAgo } from "../utils";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>(loadAlerts());
  const [type, setType] = useState<AssetType>("cripto");
  const [symbol, setSymbol] = useState("BTC");
  const [metric, setMetric] = useState<Metric>("preco");
  const [op, setOp] = useState<Op>(">=");
  const [value, setValue] = useState<number>(0);
  const [permOk, setPermOk] = useState(typeof Notification !== "undefined" && Notification.permission === "granted");

  useEffect(() => { saveAlerts(alerts); }, [alerts]);

  const add = async () => {
    if (!symbol.trim() || !Number.isFinite(value)) return;
    await ensureNotifyPermission().then(setPermOk);
    const a: Alert = {
      id: uid(), symbol: symbol.toUpperCase().replace(/USDT$/, "").trim(), type, metric, op, value,
      createdAt: new Date().toISOString(),
    };
    setAlerts((l) => [a, ...l]);
  };
  const remove = (id: string) => setAlerts((l) => l.filter((a) => a.id !== id));
  const reactivate = (id: string) => setAlerts((l) => l.map((a) => (a.id === id ? { ...a, triggered: false, triggeredAt: undefined } : a)));

  const active = alerts.filter((a) => !a.triggered);
  const done = alerts.filter((a) => a.triggered);
  const unit = metric === "preco" ? "$" : metric === "variacao24h" ? "%" : "";

  return (
    <div className="page alerts">
      <div className="market-head">
        <h1 className="page-title">Alertas <span className="dim sim-tag">o Jarvis te avisa quando bater</span></h1>
        {!permOk && (
          <button className="chip" onClick={() => ensureNotifyPermission().then(setPermOk)}>🔔 Ativar notificações</button>
        )}
      </div>

      <div className="panel alert-form">
        <div className="dir-toggle small">
          <button className={type === "cripto" ? "on long" : ""} onClick={() => { setType("cripto"); setSymbol("BTC"); }}>Cripto</button>
          <button className={type === "acao" ? "on long" : ""} onClick={() => { setType("acao"); setSymbol("NVDA"); }}>Ação</button>
        </div>
        <input className="alert-symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder={type === "acao" ? "Ticker" : "Moeda"} spellCheck={false} />
        <select value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
          <option value="preco">Preço</option>
          <option value="variacao24h">Variação 24h (%)</option>
          <option value="rsi">RSI</option>
        </select>
        <select value={op} onChange={(e) => setOp(e.target.value as Op)}>
          <option value=">=">atingir/subir a</option>
          <option value="<=">cair a</option>
        </select>
        <div className="alert-value">
          <span>{unit}</span>
          <input type="number" value={Number.isFinite(value) ? value : ""} onChange={(e) => setValue(Number(e.target.value))} />
        </div>
        <button className="sim-open-btn alert-add" onClick={add}>+ Criar alerta</button>
      </div>

      {active.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Ativos ({active.length})</h2>
          <ul className="alert-list">
            {active.map((a) => (
              <li key={a.id}>
                <span className="alert-dot pulse" />
                <span className="alert-desc">{describeAlert(a)}</span>
                <button className="mini-btn ghost" onClick={() => remove(a.id)}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {done.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Disparados</h2>
          <ul className="alert-list">
            {done.map((a) => (
              <li key={a.id} className="done">
                <span className="alert-dot fired" />
                <span className="alert-desc">{describeAlert(a)} <span className="dim">· disparou {a.triggeredAt ? timeAgo(a.triggeredAt) : ""} atrás</span></span>
                <button className="mini-btn" onClick={() => reactivate(a.id)}>reativar</button>
                <button className="mini-btn ghost" onClick={() => remove(a.id)}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!alerts.length && (
        <p className="placeholder">Nenhum alerta ainda. Crie um acima — ex.: BTC atingir $70.000, ou NVDA cair a $150, ou RSI de SOL passar de 70.</p>
      )}

      <p className="disclaimer">Os alertas são checados enquanto o app está aberto (qualquer aba). Notificação com o app fechado exigiria um app instalado.</p>
    </div>
  );
}
