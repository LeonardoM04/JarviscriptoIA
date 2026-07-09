import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { fetchBriefing } from "../api";

// Briefing proativo: o Jarvis te recebe ao abrir o app — uma vez por sessão (texto).
export default function Briefing() {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (sessionStorage.getItem("jarvis_briefed")) return;
    sessionStorage.setItem("jarvis_briefed", "1");

    fetchBriefing()
      .then(({ briefing }) => {
        setText(briefing);
        setVisible(true);
        // some sozinho depois de um tempo (dá pra ler com calma)
        setTimeout(() => setVisible(false), 22000);
      })
      .catch(() => {});
  }, []);

  if (!visible || !text) return null;

  return (
    <div className="briefing">
      <div className="briefing-orb">
        <span className="core-glow" /><span className="core-ring" />
        <Logo size={30} />
      </div>
      <div className="briefing-body">
        <div className="briefing-name">Jarvis</div>
        <p>{text}</p>
      </div>
      <div className="briefing-actions">
        <button title="Fechar" onClick={() => setVisible(false)}>×</button>
      </div>
    </div>
  );
}
