import { useState } from "react";
import { setPassword } from "../auth";
import { checkAuth } from "../api";
import Logo from "./Logo";

export default function Login({ onOk }: { onOk: () => void }) {
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPassword(pwd);
    const ok = await checkAuth();
    setLoading(false);
    if (ok) onOk();
    else setError("Senha incorreta.");
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <Logo size={48} />
          <span>Quad<span className="accent">₿</span>lock <span className="dim">Capital</span></span>
        </div>
        <p className="login-sub">Acesso restrito. Digite a senha do grupo.</p>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          placeholder="Senha"
          autoFocus
        />
        {error && <div className="error-box">{error}</div>}
        <button type="submit" disabled={loading || !pwd}>
          {loading ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
