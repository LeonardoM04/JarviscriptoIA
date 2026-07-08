import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: "◎", end: true },
  { to: "/mercado", label: "Mercado", icon: "▤" },
  { to: "/acoes", label: "Ações", icon: "▦" },
  { to: "/simulador", label: "Simulador", icon: "⊞" },
  { to: "/noticias", label: "Notícias", icon: "◈" },
];

export default function Layout() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const s = q.toUpperCase().trim().replace(/USDT$/, "");
    if (s) navigate(`/moeda/${s}`);
  };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">⚡</span>
          <span className="brand-name">
            Jarvis<span className="accent">Cripto</span>
          </span>
        </div>
        <form className="side-search" onSubmit={search}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar moeda..." spellCheck={false} />
        </form>
        <nav className="side-nav">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">Fase 1 · MVP</div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
