import { useEffect, useState } from "react";
import { fetchAlerts, createAlert, deleteAlert } from "../api";
import { describeAlert, type Alert, type AssetType, type Metric, type Op } from "../alerts";
import { enablePush, pushStatus, pushSupported } from "../push";
import { timeAgo } from "../utils";

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [type, setType] = useState<AssetType>("cripto");
  const [symbol, setSymbol] = useState("BTC");
  const [metric, setMetric] = useState<Metric>("preco");
  const [op, setOp] = useState<Op>(">=");
  const [value, setValue] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pushOn, setPushOn] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);

  const load = () => {
    fetchAlerts()
      .then((r) => { setAlerts(r.alerts); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => { pushStatus().then(setPushOn); }, []);

  const activatePush = async () => {
    setPushMsg(null);
    const r = await enablePush();
    setPushOn(r.ok);
    setPushMsg(r.ok ? "Notificações ativas neste aparelho." : (r.reason || "Não foi possível ativar."));
  };

  const add = async () => {
    if (!symbol.trim() || !Number.isFinite(value)) return;
    setSaving(true);
    try {
      await createAlert({ symbol, assetType: type, metric, op, value });
      setValue(0);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => { await deleteAlert(id); load(); };
  const reactivate = async (a: Alert) => {
    await deleteAlert(a.id);
    await createAlert({ symbol: a.symbol, assetType: a.assetType, metric: a.metric, op: a.op, value: a.value });
    load();
  };

  const active = alerts.filter((a) => !a.triggered);
  const done = alerts.filter((a) => a.triggered);
  const unit = metric === "preco" ? "$" : metric === "variacao24h" ? "%" : "";

  return (
    <div className="page alerts">
      <div className="market-head">
        <h1 className="page-title">Alertas <span className="dim sim-tag">o Jarvis te avisa quando bater</span></h1>
        {pushSupported() && (
          <button className={`chip ${pushOn ? "active" : ""}`} onClick={activatePush}>
            {pushOn ? "🔔 Notificações ativas" : "🔔 Ativar notificações neste aparelho"}
          </button>
        )}
      </div>
      {pushMsg && <div className={pushOn ? "warn-box" : "error-box"} style={{ marginBottom: 14 }}>{pushMsg}</div>}
      {error && <div className="error-box">{error}</div>}

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
        <button className="sim-open-btn alert-add" onClick={add} disabled={saving}>{saving ? "…" : "+ Criar alerta"}</button>
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
                <button className="mini-btn" onClick={() => reactivate(a)}>reativar</button>
                <button className="mini-btn ghost" onClick={() => remove(a.id)}>×</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!alerts.length && !error && (
        <p className="placeholder">Nenhum alerta ainda. Crie um acima — ex.: BTC atingir $70.000, ou NVDA cair a $150, ou RSI de SOL passar de 70.</p>
      )}

      <p className="disclaimer">
        Os alertas são vigiados <b>no servidor</b> e chegam como notificação mesmo com o app fechado — desde que você toque em <b>"Ativar notificações neste aparelho"</b> (no iPhone, é preciso instalar o app na tela de início primeiro).
      </p>
    </div>
  );
}
