import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

// Rede de segurança: se qualquer página lançar um erro de renderização, mostra
// um aviso amigável em vez de derrubar o app inteiro numa tela branca.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro capturado pelo ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="error-screen">
          <div className="error-card">
            <h2>Algo travou por aqui.</h2>
            <p className="dim">
              O Jarvis tropeçou ao montar esta tela. Nada foi perdido — recarregue que ele volta.
            </p>
            <pre className="error-detail">{this.state.error.message}</pre>
            <button className="sim-open-btn" onClick={() => window.location.reload()}>
              Recarregar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
