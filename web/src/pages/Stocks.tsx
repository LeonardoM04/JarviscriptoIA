import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStocks } from "../api";
import type { StockGroupData } from "../types";
import { changeClass, pct } from "../utils";
import Sparkline from "../components/Sparkline";

const money = (v: number, cur: string) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: cur || "USD" }).format(v);

export default function Stocks() {
  const [groups, setGroups] = useState<StockGroupData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchStocks()
        .then((r) => { if (active) { setGroups(r.groups); setError(null); } })
        .catch((e) => active && setError(e instanceof Error ? e.message : String(e)))
        .finally(() => active && setLoading(false));
    };
    load();
    const id = setInterval(load, 120_000);
    return () => { active = false; clearInterval(id); };
  }, []);

  return (
    <div className="page stocks">
      <h1 className="page-title">Ações <span className="dim sim-tag">computação quântica · IA</span></h1>
      {error && <div className="error-box">{error}</div>}
      {loading && !groups.length && <div className="dim">Carregando cotações…</div>}

      {groups.map((g) => (
        <section key={g.id} className="panel stock-group">
          <h2 className="panel-title">{g.label}</h2>
          <div className="table-wrap">
            <table className="market-table">
              <thead>
                <tr><th className="left">Ação</th><th>Preço</th><th>Variação (dia)</th><th>30 dias</th></tr>
              </thead>
              <tbody>
                {g.stocks.map((s) => (
                  <tr key={s.symbol}>
                    <td className="left">
                      <Link to={`/acao/${s.symbol}`} className="coin-cell">
                        <span className="stock-ticker">{s.symbol}</span>
                        <span className="coin-name">{s.name}</span>
                      </Link>
                    </td>
                    <td className="mono">{money(s.price, s.currency)}</td>
                    <td className={changeClass(s.changePct)}>{pct(s.changePct)}</td>
                    <td><Sparkline data={s.sparkline} width={90} height={28} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="disclaimer">Cotações via Yahoo Finance, atualizadas a cada 2 min. Não é recomendação de investimento.</p>
    </div>
  );
}
