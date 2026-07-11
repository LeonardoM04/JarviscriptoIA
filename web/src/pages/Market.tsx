import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchMarkets } from "../api";
import type { MarketCoin } from "../types";
import { changeClass, compact, money, pct } from "../utils";
import Sparkline from "../components/Sparkline";

type SortKey = "market_cap_rank" | "price_change_percentage_24h" | "price_change_percentage_7d" | "total_volume";

export default function Market() {
  const [markets, setMarkets] = useState<MarketCoin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("market_cap_rank");
  const [asc, setAsc] = useState(true);

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchMarkets()
        .then((m) => { if (active) { setMarkets(m.markets); setError(null); } })
        .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    };
    load();
    const id = setInterval(load, 120_000); // auto-refresh a cada 2 min
    return () => { active = false; clearInterval(id); };
  }, []);

  const rows = useMemo(() => {
    const filtered = markets.filter(
      (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.symbol.toLowerCase().includes(query.toLowerCase())
    );
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a[sort] ?? 0) as number;
      const bv = (b[sort] ?? 0) as number;
      return (av - bv) * dir;
    });
  }, [markets, query, sort, asc]);

  const toggleSort = (key: SortKey) => {
    if (sort === key) setAsc(!asc);
    else {
      setSort(key);
      setAsc(key === "market_cap_rank");
    }
  };

  const arrow = (key: SortKey) => (sort === key ? (asc ? " ▲" : " ▼") : "");

  return (
    <div className="page market">
      <div className="market-head">
        <h1 className="page-title">Mercado</h1>
        <input className="market-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar moeda..." />
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="table-wrap">
        <table className="market-table">
          <thead>
            <tr>
              <th onClick={() => toggleSort("market_cap_rank")}>#{arrow("market_cap_rank")}</th>
              <th className="left">Moeda</th>
              <th>Preço</th>
              <th>1h</th>
              <th onClick={() => toggleSort("price_change_percentage_24h")}>24h{arrow("price_change_percentage_24h")}</th>
              <th onClick={() => toggleSort("price_change_percentage_7d")}>7d{arrow("price_change_percentage_7d")}</th>
              <th onClick={() => toggleSort("total_volume")}>Volume{arrow("total_volume")}</th>
              <th>7 dias</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td className="dim">{c.market_cap_rank}</td>
                <td className="left">
                  <Link to={`/moeda/${c.symbol.toUpperCase()}`} className="coin-cell">
                    <img src={c.image} alt="" width={24} height={24} />
                    <span className="coin-name">{c.name}</span>
                    <span className="coin-ticker">{c.symbol.toUpperCase()}</span>
                  </Link>
                </td>
                <td className="mono">{money(c.current_price)}</td>
                <td className={changeClass(c.price_change_percentage_1h)}>{pct(c.price_change_percentage_1h, 1)}</td>
                <td className={changeClass(c.price_change_percentage_24h)}>{pct(c.price_change_percentage_24h, 1)}</td>
                <td className={changeClass(c.price_change_percentage_7d)}>{pct(c.price_change_percentage_7d, 1)}</td>
                <td className="dim mono">{compact(c.total_volume)}</td>
                <td><Sparkline data={c.sparkline} width={90} height={28} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
