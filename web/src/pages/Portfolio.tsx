import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchPortfolio, addTransaction, deleteTransaction, analyzePortfolio } from "../api";
import type { PortfolioData } from "../types";
import { changeClass, pct } from "../utils";

const brl = (v: number) => "$" + v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const num = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: v < 1 ? 6 : 4 });

export default function Portfolio() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // formulário de transação
  const [assetType, setAssetType] = useState<"cripto" | "acao">("cripto");
  const [symbol, setSymbol] = useState("BTC");
  const [side, setSide] = useState<"compra" | "venda">("compra");
  const [quantity, setQuantity] = useState<number>(0);
  const [price, setPrice] = useState<number>(0);
  const [person, setPerson] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const load = () => {
    fetchPortfolio()
      .then((d) => { setData(d); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const people = useMemo(() => [...new Set((data?.transactions || []).map((t) => t.person))], [data]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || quantity <= 0 || price < 0) return;
    setSaving(true);
    try {
      await addTransaction({ symbol, assetType, side, quantity, price, person: person.trim() || "—", note: note.trim() || undefined });
      setQuantity(0); setPrice(0); setNote("");
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id: string) => { await deleteTransaction(id); load(); };
  const analyze = async () => {
    setAnalyzing(true); setAnalysis(null);
    try { setAnalysis((await analyzePortfolio()).analysis); }
    catch (e) { setAnalysis(e instanceof Error ? e.message : String(e)); }
    finally { setAnalyzing(false); }
  };

  const s = data?.summary;
  const maxPerson = Math.max(1, ...(data?.people || []).map((p) => Math.abs(p.net)));

  return (
    <div className="page portfolio">
      <div className="market-head">
        <h1 className="page-title">Carteira do grupo</h1>
        <button className="analyze-btn" style={{ width: "auto", padding: "9px 16px" }} onClick={analyze} disabled={analyzing || !data?.positions.length}>
          {analyzing ? "Jarvis analisando…" : "🧠 Jarvis analisa a carteira"}
        </button>
      </div>
      {error && <div className="error-box">{error}</div>}
      {loading && <div className="dim">Carregando…</div>}

      {data?.storageMode === "local" && (
        <div className="warn-box">⚠️ Guardando localmente no servidor (some se ele reiniciar). Adicione um banco grátis pra ficar permanente e 100% compartilhado — veja o rodapé.</div>
      )}

      {s && (
        <div className="stat-grid">
          <div className="stat-card"><span className="stat-label">Valor atual</span><span className="stat-value">{brl(s.totalMarket)}</span><span className="stat-sub">investido {brl(s.totalInvested)}</span></div>
          <div className="stat-card"><span className="stat-label">Lucro/prejuízo (aberto)</span><span className={`stat-value ${changeClass(s.totalUnrealized)}`}>{brl(s.totalUnrealized)}</span><span className={`stat-sub ${changeClass(s.totalUnrealized)}`}>{pct(s.totalUnrealizedPct)}</span></div>
          <div className="stat-card"><span className="stat-label">Realizado</span><span className={`stat-value ${changeClass(s.totalRealized)}`}>{brl(s.totalRealized)}</span><span className="stat-sub">vendas concluídas</span></div>
        </div>
      )}

      {analysis && <div className="panel jarvis-analysis"><b className="accent">🧠 Jarvis:</b> {analysis}</div>}

      <div className="port-cols">
        <div>
          {/* posições */}
          <section className="panel">
            <h2 className="panel-title">Posições</h2>
            {data?.positions.length ? (
              <div className="table-wrap" style={{ background: "none", border: "none" }}>
                <table className="market-table">
                  <thead><tr><th className="left">Ativo</th><th>Qtd</th><th>Preço médio</th><th>Atual</th><th>Valor</th><th>P/L</th></tr></thead>
                  <tbody>
                    {data.positions.map((p) => {
                      const route = p.assetType === "acao" ? `/acao/${encodeURIComponent(p.symbol)}` : `/moeda/${p.symbol}`;
                      return (
                        <tr key={`${p.assetType}:${p.symbol}`}>
                          <td className="left"><Link to={route} className="coin-cell"><span className="stock-ticker">{p.symbol}</span><span className="coin-name dim">{p.assetType}</span></Link></td>
                          <td className="mono">{num(p.quantity)}</td>
                          <td className="mono">{brl(p.avgPrice)}</td>
                          <td className="mono">{p.currentPrice != null ? brl(p.currentPrice) : "—"}</td>
                          <td className="mono">{p.marketValue != null ? brl(p.marketValue) : "—"}</td>
                          <td className={`mono ${changeClass(p.unrealizedPnl ?? 0)}`}>{p.unrealizedPnl != null ? brl(p.unrealizedPnl) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className="placeholder">Nenhuma posição ainda. Registre um aporte ao lado.</p>}
          </section>

          {/* histórico */}
          {data?.transactions.length ? (
            <section className="panel">
              <h2 className="panel-title">Histórico de transações</h2>
              <ul className="tx-list">
                {[...data.transactions].reverse().map((t) => (
                  <li key={t.id}>
                    <span className={`tag-dir ${t.side === "compra" ? "long" : "short"}`}>{t.side === "compra" ? "C" : "V"}</span>
                    <span className="tx-main">{num(t.quantity)} {t.symbol} @ {brl(t.price)}</span>
                    <span className="tx-meta dim">{t.person} · {new Date(t.createdAt).toLocaleDateString("pt-BR")}</span>
                    <button className="mini-btn ghost" onClick={() => del(t.id)}>×</button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <div>
          {/* adicionar */}
          <section className="panel">
            <h2 className="panel-title">Registrar transação</h2>
            <form className="tx-form" onSubmit={submit}>
              <div className="dir-toggle small">
                <button type="button" className={assetType === "cripto" ? "on long" : ""} onClick={() => { setAssetType("cripto"); setSymbol("BTC"); }}>Cripto</button>
                <button type="button" className={assetType === "acao" ? "on long" : ""} onClick={() => { setAssetType("acao"); setSymbol("NVDA"); }}>Ação/Ativo</button>
              </div>
              <div className="dir-toggle small">
                <button type="button" className={side === "compra" ? "on long" : ""} onClick={() => setSide("compra")}>Compra</button>
                <button type="button" className={side === "venda" ? "on short" : ""} onClick={() => setSide("venda")}>Venda</button>
              </div>
              <label>Ativo<input value={symbol} onChange={(e) => setSymbol(e.target.value)} spellCheck={false} /></label>
              <label>Quantidade<input type="number" step="any" value={quantity || ""} onChange={(e) => setQuantity(Number(e.target.value))} /></label>
              <label>Preço unitário ($)<input type="number" step="any" value={price || ""} onChange={(e) => setPrice(Number(e.target.value))} /></label>
              <label>Sócio
                <input value={person} onChange={(e) => setPerson(e.target.value)} list="people" placeholder="quem fez" />
                <datalist id="people">{people.map((p) => <option key={p} value={p} />)}</datalist>
              </label>
              <label>Nota (opcional)<input value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <button className="sim-open-btn" type="submit" disabled={saving}>{saving ? "Salvando…" : "+ Registrar"}</button>
            </form>
          </section>

          {/* aportes por sócio */}
          {data?.people.length ? (
            <section className="panel">
              <h2 className="panel-title">Aportes por sócio (líquido)</h2>
              <div className="people-bars">
                {data.people.map((p) => (
                  <div key={p.person} className="person-row">
                    <span className="person-name">{p.person}</span>
                    <div className="person-bar"><div style={{ width: `${(Math.abs(p.net) / maxPerson) * 100}%` }} className={p.net >= 0 ? "pos" : "neg"} /></div>
                    <span className="person-val mono">{brl(p.net)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      <p className="disclaimer">
        Para deixar a carteira <b>permanente e compartilhada de verdade</b> entre vocês 3, adicione um banco grátis (Postgres do Neon ou Render) e configure a variável <code>DATABASE_URL</code> no Render. Sem ela, os dados ficam no servidor e podem sumir ao reiniciar.
      </p>
    </div>
  );
}
