import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import Logo from "./Logo";
import JarvisChat from "./JarvisChat";
import Briefing from "./Briefing";
import AlertsWatcher from "./AlertsWatcher";

const nav = [
  { to: "/", label: "Dashboard", icon: "◎", end: true },
  { to: "/mercado", label: "Mercado", icon: "▤" },
  { to: "/acoes", label: "Bolsa", icon: "▦" },
  { to: "/carteira", label: "Carteira", icon: "◇" },
  { to: "/simulador", label: "Simulador", icon: "⊞" },
  { to: "/alertas", label: "Alertas", icon: "◔" },
  { to: "/noticias", label: "Notícias", icon: "◈" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const s = q.toUpperCase().trim().replace(/USDT$/, "");
    if (!s) return;
    setQ("");
    // commodities (GC=F), índices (^VIX) e tickers com número vão pra bolsa;
    // o resto tratamos como cripto (comportamento padrão da busca lateral).
    if (/[=^]/.test(s)) navigate(`/acao/${encodeURIComponent(s)}`);
    else navigate(`/moeda/${s}`);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <Logo size={30} className="brand-logo" />
          <span className="brand-name">
            Quad<span className="accent">₿</span>lock
          </span>
        </div>
        <form className="side-search" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ativo (BTC, ^VIX)…" spellCheck={false} />
        </form>
        <nav className="side-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">Quad<span className="accent">₿</span>lock Capital · dados ao vivo</div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <JarvisChat />
      <Briefing />
      <AlertsWatcher />
    </div>
  );
}
