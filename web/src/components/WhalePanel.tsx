import type { Derivatives, Liquidation } from "../types";
import { compact } from "../utils";

interface Props {
  derivatives: Derivatives | null;
  liquidations: Liquidation[];
}

const timeHM = (ms: number) =>
  new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export default function WhalePanel({ derivatives, liquidations }: Props) {
  const buy = derivatives?.buyRatio ?? null;
  const sell = derivatives?.sellRatio ?? null;

  return (
    <div className="whale-panel">
      <p className="whale-intro">Posicionamento dos grandes players e liquidações em tempo real (perpétuos).</p>

      {buy != null && sell != null ? (
        <div className="ls-block">
          <div className="ls-head">
            <span className="up">Longs {(buy * 100).toFixed(0)}%</span>
            <span className="down">{(sell * 100).toFixed(0)}% Shorts</span>
          </div>
          <div className="ls-bar">
            <div className="ls-long" style={{ width: `${buy * 100}%` }} />
            <div className="ls-short" style={{ width: `${sell * 100}%` }} />
          </div>
          <p className="ls-hint">
            {buy > 0.62 ? "Excesso de longs — combustível para liquidação em quedas." : sell > 0.62 ? "Excesso de shorts — risco de short-squeeze em altas." : "Equilíbrio saudável entre compradores e vendedores."}
          </p>
        </div>
      ) : (
        <p className="dim">Proporção long/short indisponível para esta moeda.</p>
      )}

      {derivatives?.available && (
        <div className="deriv-cards">
          <div><span>Funding</span><b>{derivatives.fundingRate?.toFixed(4)}%</b></div>
          <div><span>Open Interest</span><b>{derivatives.oiTrend ?? "—"}</b></div>
          {derivatives.openInterestValueUsd && <div><span>OI (USD)</span><b>{compact(derivatives.openInterestValueUsd)}</b></div>}
        </div>
      )}

      <h4>Liquidações ao vivo</h4>
      {liquidations.length ? (
        <ul className="liq-list">
          {liquidations.map((l, i) => (
            <li key={i} className={l.side}>
              <span className="liq-side">{l.side === "long" ? "Long liquidado" : "Short liquidado"}</span>
              <span className="liq-size">{compact(l.sizeUsd)}</span>
              <span className="liq-time dim">{timeHM(l.time)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dim liq-wait">Aguardando liquidações… (aparecem quando uma posição alavancada é estourada)</p>
      )}
    </div>
  );
}
