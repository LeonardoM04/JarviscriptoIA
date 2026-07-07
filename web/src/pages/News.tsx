import { useEffect, useState } from "react";
import { fetchNews } from "../api";
import type { NewsItem } from "../types";
import { timeAgo } from "../utils";

const sentimentLabel: Record<string, string> = { positivo: "Alta", negativo: "Baixa", neutro: "Neutro" };

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"todas" | "positivo" | "negativo">("todas");

  useEffect(() => {
    let active = true;
    const load = () => {
      fetchNews()
        .then((n) => { if (active) { setNews(n.news); setError(null); } })
        .catch((e) => active && setError(e instanceof Error ? e.message : String(e)));
    };
    load();
    const id = setInterval(load, 180_000); // auto-refresh a cada 3 min
    return () => { active = false; clearInterval(id); };
  }, []);

  const rows = news.filter((n) => filter === "todas" || n.sentiment === filter);

  return (
    <div className="page news-page">
      <div className="market-head">
        <h1 className="page-title">Notícias do mercado</h1>
        <div className="intervals">
          {(["todas", "positivo", "negativo"] as const).map((f) => (
            <button key={f} className={filter === f ? "chip active" : "chip"} onClick={() => setFilter(f)}>
              {f === "todas" ? "Todas" : sentimentLabel[f]}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="error-box">{error}</div>}

      <ul className="news-full">
        {rows.map((n, i) => (
          <li key={i}>
            <span className={`impact ${n.sentiment}`}>{sentimentLabel[n.sentiment]}</span>
            <div className="news-body">
              <a href={n.url} target="_blank" rel="noreferrer">{n.title}</a>
              <div className="news-meta">
                {n.source} · {timeAgo(n.publishedAt)}
                {n.currencies.length > 0 && <span className="news-coins">{n.currencies.slice(0, 4).join(" · ")}</span>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
