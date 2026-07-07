import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchGlobal, fetchMarkets, fetchNews } from "../api";
import type { FearGreed, GlobalData, MarketCoin, NewsItem } from "../types";
import { changeClass, compact, pct, timeAgo } from "../utils";
import Sparkline from "../components/Sparkline";

const fgColor = (v: number) => (v >= 60 ? "#2ebd85" : v <= 40 ? "#e04f5f" : "#fbbf24");

export default function Dashboard() {
  const [global, setGlobal] = useState<GlobalData | null>(null);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [markets, setMarkets] = useState<MarketCoin[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = () => {
      Promise.all([fetchGlobal(), fetchMarkets(), fetchNews()])
        .then(([g, m, n]) => {
          if (!active) return;
          setGlobal(g.global);
          setFearGreed(g.fearGreed);
          setMarkets(m.markets);
          setNews(n.news);
          setError(null);
        })
        .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    };
    load();
    const id = setInterval(load, 120_000); // auto-refresh a cada 2 min
    return () => { active = false; clearInterval(id); };
  }, []);

  const sorted = [...markets].filter((m) => m.price_change_percentage_24h != null);
  const gainers = [...sorted].sort((a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)).slice(0, 5);
  const losers = [...sorted].sort((a, b) => (a.price_change_percentage_24h ?? 0) - (b.price_change_percentage_24h ?? 0)).slice(0, 5);

  return (
    <div className="page dashboard">
      <h1 className="page-title">Visão geral do mercado</h1>
      {error && <div className="error-box">{error}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Mercado total</span>
          <span className="stat-value">{global ? compact(global.totalMarketCapUsd) : "…"}</span>
          {global && <span className={`stat-sub ${changeClass(global.marketCapChange24h)}`}>{pct(global.marketCapChange24h)} (24h)</span>}
        </div>
        <div className="stat-card">
          <span className="stat-label">Dominância BTC</span>
          <span className="stat-value">{global ? `${global.btcDominance.toFixed(1)}%` : "…"}</span>
          {global && <span className="stat-sub">ETH {global.ethDominance.toFixed(1)}%</span>}
        </div>
        <div className="stat-card">
          <span className="stat-label">Medo & Ganância</span>
          <span className="stat-value" style={{ color: fearGreed ? fgColor(fearGreed.value) : undefined }}>
            {fearGreed ? fearGreed.value : "…"}
          </span>
          {fearGreed && <span className="stat-sub">{fearGreed.label}</span>}
        </div>
      </div>

      <div className="dash-cols">
        <section className="panel">
          <h2 className="panel-title up">▲ Maiores altas (24h)</h2>
          <MoverList coins={gainers} />
        </section>
        <section className="panel">
          <h2 className="panel-title down">▼ Maiores baixas (24h)</h2>
          <MoverList coins={losers} />
        </section>
      </div>

      <section className="panel">
        <h2 className="panel-title">Manchetes que importam</h2>
        <ul className="news-mini">
          {news.slice(0, 8).map((n, i) => (
            <li key={i}>
              <span className={`dot ${n.sentiment}`} />
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              <span className="news-meta">{n.source} · {timeAgo(n.publishedAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MoverList({ coins }: { coins: MarketCoin[] }) {
  return (
    <ul className="mover-list">
      {coins.map((c) => (
        <li key={c.id}>
          <Link to={`/moeda/${c.symbol.toUpperCase()}`} className="mover">
            <img src={c.image} alt="" width={22} height={22} />
            <span className="mover-name">{c.symbol.toUpperCase()}</span>
            <Sparkline data={c.sparkline} width={70} height={22} />
            <span className={`mover-pct ${changeClass(c.price_change_percentage_24h)}`}>{pct(c.price_change_percentage_24h)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
