import { useEffect, useMemo, useState } from "react";
import { fetchTicker } from "../api";
import {
  computeMetrics,
  livePnl,
  loadPositions,
  savePositions,
  type Direction,
  type PaperPosition,
  type SimInputs,
} from "../sim";
import { money, pct } from "../utils";

const uid = () => Math.random().toString(36).slice(2, 10);

export default function Simulator() {
  const [symbol, setSymbol] = useState("BTC");
  const [direction, setDirection] = useState<Direction>("long");
  const [entry, setEntry] = useState<number>(0);
  const [margin, setMargin] = useState<number>(100);
  const [leverage, setLeverage] = useState<number>(10);
  const [target, setTarget] = useState<number>(0);
  const [stop, setStop] = useState<number>(0);

  const [positions, setPositions] = useState<PaperPosition[]>(loadPositions());
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  const norm = (s: string) => (s.toUpperCase().replace(/USDT$/, "") + "USDT");

  // buscar preço atual do símbolo digitado (preenche entrada/alvo/stop)
  const loadPrice = async () => {
    setPriceLoading(true);
    try {
      const { ticker } = await fetchTicker(norm(symbol));
      const p = ticker.lastPrice;
      setEntry(p);
      setTarget(Number((p * 1.05).toPrecision(6)));
      setStop(Number((p * 0.97).toPrecision(6)));
    } catch {
      /* ignora */
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    loadPrice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // preços ao vivo das posições abertas (atualiza a cada 15s)
  useEffect(() => {
    const symbols = [...new Set(positions.filter((p) => p.status === "aberta").map((p) => p.symbol))];
    if (!symbols.length) return;
    let active = true;
    const load = async () => {
      const entries = await Promise.all(
        symbols.map((s) => fetchTicker(s).then((t) => [s, t.ticker.lastPrice] as const).catch(() => null))
      );
      if (active) setPrices((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(Boolean) as [string, number][]) }));
    };
    load();
    const id = setInterval(load, 15000);
    return () => { active = false; clearInterval(id); };
  }, [positions]);

  const inputs: SimInputs = { symbol: norm(symbol), direction, entry, margin, leverage, target, stop };
  const m = useMemo(() => computeMetrics(inputs), [direction, entry, margin, leverage, target, stop]);

  const persist = (list: PaperPosition[]) => { setPositions(list); savePositions(list); };

  const openPosition = () => {
    if (m.warning || !entry || !margin) return;
    const pos: PaperPosition = {
      id: uid(), symbol: norm(symbol), direction, entry, margin, leverage, target, stop,
      qty: m.qty, liquidation: m.liquidation, openedAt: new Date().toISOString(), status: "aberta",
    };
    persist([pos, ...positions]);
  };

  const closePosition = (id: string) => {
    persist(positions.map((p) => {
      if (p.id !== id || p.status !== "aberta") return p;
      const price = prices[p.symbol] ?? p.entry;
      const { pnl } = livePnl(p, price);
      return { ...p, status: "fechada", closePrice: price, closedAt: new Date().toISOString(), realizedPnl: pnl };
    }));
  };

  const remove = (id: string) => persist(positions.filter((p) => p.id !== id));

  const open = positions.filter((p) => p.status === "aberta");
  const closed = positions.filter((p) => p.status === "fechada");
  const totalRealized = closed.reduce((s, p) => s + (p.realizedPnl ?? 0), 0);
  const openPnl = open.reduce((s, p) => s + livePnl(p, prices[p.symbol] ?? p.entry).pnl, 0);

  const cls = (v: number) => (v >= 0 ? "up" : "down");

  return (
    <div className="page sim">
      <h1 className="page-title">Simulador de trades <span className="dim sim-tag">paper trading · dinheiro fake</span></h1>

      <div className="sim-body">
        {/* ---- calculadora ---- */}
        <div className="sim-calc">
          <div className="sim-row">
            <label>Par
              <div className="sim-symbol">
                <input value={symbol} onChange={(e) => setSymbol(e.target.value)} spellCheck={false} />
                <button onClick={loadPrice} disabled={priceLoading}>{priceLoading ? "…" : "preço atual"}</button>
              </div>
            </label>
            <label>Direção
              <div className="dir-toggle">
                <button className={direction === "long" ? "on long" : ""} onClick={() => setDirection("long")}>Long</button>
                <button className={direction === "short" ? "on short" : ""} onClick={() => setDirection("short")}>Short</button>
              </div>
            </label>
          </div>

          <div className="sim-row">
            <NumField label="Entrada ($)" value={entry} onChange={setEntry} />
            <NumField label="Margem ($)" value={margin} onChange={setMargin} />
          </div>
          <div className="sim-row">
            <label>Alavancagem: <b>{leverage}x</b>
              <input type="range" min={1} max={125} value={leverage} onChange={(e) => setLeverage(Number(e.target.value))} />
            </label>
          </div>
          <div className="sim-row">
            <NumField label="Alvo ($)" value={target} onChange={setTarget} accent="up" />
            <NumField label="Stop ($)" value={stop} onChange={setStop} accent="down" />
          </div>

          {m.warning && <div className="error-box">{m.warning}</div>}

          <button className="sim-open-btn" onClick={openPosition} disabled={!!m.warning || !entry}>
            + Abrir posição simulada
          </button>
        </div>

        {/* ---- métricas ---- */}
        <div className="sim-metrics">
          <div className="metric-grid">
            <Metric label="Tamanho da posição" value={money(m.notional)} sub={`${m.qty.toPrecision(4)} ${symbol.toUpperCase()}`} />
            <Metric label="Preço de liquidação" value={money(m.liquidation)} accent="down"
              sub={`${pct(((m.liquidation - entry) / (entry || 1)) * 100, 1)} da entrada`} />
            <Metric label="Risco / Retorno" value={m.riskReward ? `1 : ${m.riskReward.toFixed(2)}` : "—"}
              sub={m.riskReward >= 2 ? "favorável" : m.riskReward >= 1 ? "ok" : "arriscado"} />
          </div>

          <div className="scenario win">
            <div className="scenario-head"><span>🎯 No alvo</span><b className="up">{money(m.targetPnl)}</b></div>
            <div className="scenario-sub">
              ROI sobre a margem <b className="up">{pct(m.targetRoi, 1)}</b> · movimento do preço {pct(m.targetMovePct, 2)}
            </div>
          </div>
          <div className="scenario loss">
            <div className="scenario-head"><span>🛑 No stop</span><b className="down">{money(m.stopPnl)}</b></div>
            <div className="scenario-sub">
              ROI sobre a margem <b className="down">{pct(m.stopRoi, 1)}</b> · movimento do preço {pct(m.stopMovePct, 2)}
            </div>
          </div>
          <p className="sim-note">Liquidação e taxas são estimativas — cada corretora calcula um pouco diferente.</p>
        </div>
      </div>

      {/* ---- posições ---- */}
      {open.length > 0 && (
        <section className="panel sim-positions">
          <h2 className="panel-title">Posições abertas · P/L não realizado <b className={cls(openPnl)}>{money(openPnl)}</b></h2>
          <table className="sim-table">
            <thead><tr><th className="left">Par</th><th>Entrada</th><th>Atual</th><th>Alav.</th><th>P/L</th><th>ROI</th><th></th></tr></thead>
            <tbody>
              {open.map((p) => {
                const price = prices[p.symbol] ?? p.entry;
                const { pnl, roi } = livePnl(p, price);
                return (
                  <tr key={p.id}>
                    <td className="left"><span className={`tag-dir ${p.direction}`}>{p.direction === "long" ? "L" : "S"}</span> {p.symbol.replace(/USDT$/, "")}</td>
                    <td className="mono">{money(p.entry)}</td>
                    <td className="mono">{money(price)}</td>
                    <td>{p.leverage}x</td>
                    <td className={`mono ${cls(pnl)}`}>{money(pnl)}</td>
                    <td className={cls(roi)}>{pct(roi, 1)}</td>
                    <td><button className="mini-btn" onClick={() => closePosition(p.id)}>Fechar</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {closed.length > 0 && (
        <section className="panel sim-positions">
          <h2 className="panel-title">Histórico · resultado realizado <b className={cls(totalRealized)}>{money(totalRealized)}</b></h2>
          <table className="sim-table">
            <thead><tr><th className="left">Par</th><th>Entrada</th><th>Saída</th><th>Alav.</th><th>Resultado</th><th></th></tr></thead>
            <tbody>
              {closed.map((p) => (
                <tr key={p.id}>
                  <td className="left"><span className={`tag-dir ${p.direction}`}>{p.direction === "long" ? "L" : "S"}</span> {p.symbol.replace(/USDT$/, "")}</td>
                  <td className="mono">{money(p.entry)}</td>
                  <td className="mono">{money(p.closePrice ?? 0)}</td>
                  <td>{p.leverage}x</td>
                  <td className={`mono ${cls(p.realizedPnl ?? 0)}`}>{money(p.realizedPnl ?? 0)}</td>
                  <td><button className="mini-btn ghost" onClick={() => remove(p.id)}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function NumField({ label, value, onChange, accent }: { label: string; value: number; onChange: (v: number) => void; accent?: string }) {
  return (
    <label>{label}
      <input className={accent} type="number" value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${accent || ""}`}>{value}</span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}
