import { useEffect, useState } from "react";
import type { AnalyzeResponse } from "../types";
import { money } from "../utils";
import { canSpeak, speak, stopSpeak } from "../voice";

// ---- voz do Jarvis (Web Speech API — nativa do navegador, pt-BR) ----
function buildSpeech(r: AnalyzeResponse): string {
  const a = r.analysis;
  return [
    `Análise de ${r.symbol.replace(/USDT$/, "")}.`,
    a.veredito,
    `Tendência ${a.tendencia}, força ${a.forca_tendencia}.`,
    `Minha tese: ${a.tese}`,
    `Recomendação: ${a.recomendacao}, com confiança de ${a.confianca} por cento.`,
    `Plano: entrada ${a.plano.zona_entrada}. Stop em ${a.plano.stop}. Tamanho sugerido: ${a.plano.tamanho_sugerido}.`,
    `Atenção: isto não é recomendação financeira.`,
  ].join(" ");
}

interface Props {
  result: AnalyzeResponse | null;
  loading: boolean;
  error: string | null;
  onAnalyze: () => void;
}

const trendColor: Record<string, string> = { alta: "#2ebd85", baixa: "#e04f5f", lateral: "#fbbf24" };
const recColor = (rec: string) =>
  /compr|acumular/.test(rec) ? "#2ebd85" : /vend|reduzir/.test(rec) ? "#e04f5f" : "#fbbf24";

export default function AnalysisPanel({ result, loading, error, onAnalyze }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => stopSpeak(), []);

  const toggleSpeech = () => {
    if (!result || !canSpeak) return;
    if (speaking) {
      stopSpeak();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(buildSpeech(result), () => setSpeaking(false));
  };

  return (
    <div className="analysis-panel">
      <button className="analyze-btn" onClick={onAnalyze} disabled={loading}>
        {loading ? "Jarvis pensando..." : "🧠 Análise profunda com IA"}
      </button>

      {error && <div className="error-box">{error}</div>}
      {loading && (
        <div className="loading-box">
          Reunindo 1h/4h/diário, derivativos, notícias e enxergando o gráfico. O Claude está raciocinando em
          esforço máximo — pode levar de 30s a 2min.
        </div>
      )}

      {result && !loading && (
        <div className="analysis-content">
          <div className="verdict-row">
            <div className="verdict">"{result.analysis.veredito}"</div>
            {canSpeak && (
              <button className={`voice-btn ${speaking ? "speaking" : ""}`} onClick={toggleSpeech}
                title={speaking ? "Parar" : "Ouvir a análise na voz do Jarvis"}>
                {speaking ? "⏹" : "🔊"}
              </button>
            )}
          </div>

          <div className="badges">
            <span className="badge" style={{ borderColor: trendColor[result.analysis.tendencia] }}>
              Tendência <b style={{ color: trendColor[result.analysis.tendencia] }}>{result.analysis.tendencia}</b> ({result.analysis.forca_tendencia})
            </span>
            <span className="badge big" style={{ borderColor: recColor(result.analysis.recomendacao) }}>
              <b style={{ color: recColor(result.analysis.recomendacao) }}>{result.analysis.recomendacao.toUpperCase()}</b>
            </span>
            <span className="badge">Confiança {result.analysis.confianca}%</span>
            {result.usedVision && <span className="badge vision">👁 viu o gráfico</span>}
          </div>

          <h4>Tese</h4>
          <p>{result.analysis.tese}</p>

          <div className="plan-card">
            <h4>Plano de trade</h4>
            <div className="plan-grid">
              <div><span>Entrada</span><b>{result.analysis.plano.zona_entrada}</b></div>
              <div><span>Alvos</span><b className="up">{result.analysis.plano.alvos.map((a) => money(a)).join(" · ")}</b></div>
              <div><span>Stop</span><b className="down">{money(result.analysis.plano.stop)}</b></div>
              <div><span>Tamanho</span><b>{result.analysis.plano.tamanho_sugerido}</b></div>
              <div><span>Horizonte</span><b>{result.analysis.plano.horizonte}</b></div>
            </div>
          </div>

          <h4>Invalidação</h4>
          <p className="invalidacao">{result.analysis.invalidacao}</p>

          <h4>Confluência entre timeframes</h4>
          <p>{result.analysis.confluencia}</p>

          <h4>Leitura de ciclo</h4>
          <p>{result.analysis.leitura_de_ciclo}</p>

          <div className="signals">
            <div>
              <h5 className="up">Sinais de alta</h5>
              <ul>{result.analysis.sinais_alta.length ? result.analysis.sinais_alta.map((s, i) => <li key={i}>{s}</li>) : <li>—</li>}</ul>
            </div>
            <div>
              <h5 className="down">Sinais de baixa</h5>
              <ul>{result.analysis.sinais_baixa.length ? result.analysis.sinais_baixa.map((s, i) => <li key={i}>{s}</li>) : <li>—</li>}</ul>
            </div>
          </div>

          <h4>Derivativos</h4>
          <p>{result.analysis.derivativos_leitura}</p>

          <h4>Impacto das notícias</h4>
          <p>{result.analysis.noticias_impacto}</p>

          <h4>Riscos</h4>
          <ul>{result.analysis.riscos.map((r, i) => <li key={i}>{r}</li>)}</ul>

          <p className="disclaimer">⚠️ Gerado por IA a partir de dados técnicos. Não é recomendação financeira.</p>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="placeholder">
          O Jarvis cruza 1h + 4h + diário, lê os derivativos (funding/open interest), as notícias e <b>enxerga o
          gráfico</b> para gerar tese, plano de trade e nível de confiança.
        </div>
      )}
    </div>
  );
}
