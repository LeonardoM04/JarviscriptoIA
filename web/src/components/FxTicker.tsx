import { useEffect, useRef, useState } from "react";
import { fetchFx, type FxRate } from "../api";
import { pct, changeClass } from "../utils";

// cotação em real (pt-BR): R$ 5,43
const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function FxTicker() {
  const [rates, setRates] = useState<FxRate[]>([]);
  const prev = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, "up" | "down">>({});

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const { rates } = await fetchFx();
        if (!alive) return;
        // pisca verde/vermelho quando a cotação muda em relação à leitura anterior
        const f: Record<string, "up" | "down"> = {};
        for (const r of rates) {
          const before = prev.current[r.symbol];
          if (before !== undefined && before !== r.price) f[r.symbol] = r.price > before ? "up" : "down";
          prev.current[r.symbol] = r.price;
        }
        setRates(rates);
        if (Object.keys(f).length) {
          setFlash(f);
          setTimeout(() => alive && setFlash({}), 700);
        }
      } catch {
        /* silencioso — a faixa some se o câmbio falhar */
      }
    };
    load();
    const id = setInterval(load, 30_000); // atualiza a cada 30s
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  if (!rates.length) return null;

  return (
    <div className="fx-bar">
      {rates.map((r) => (
        <div key={r.symbol} className={`fx-item ${flash[r.symbol] ? "fx-flash-" + flash[r.symbol] : ""}`}>
          <span className="fx-label">{r.label}</span>
          <span className="fx-price mono">{brl(r.price)}</span>
          <span className={`fx-change mono ${changeClass(r.changePct)}`}>{pct(r.changePct)}</span>
        </div>
      ))}
      <span className="fx-live">ao vivo</span>
    </div>
  );
}
