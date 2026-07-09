import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { fetchBriefing } from "../api";
import { canSpeak, speak, stopSpeak } from "../voice";

// Briefing proativo: o Jarvis te recebe (falando) ao abrir o app — uma vez por sessão.
export default function Briefing() {
  const [text, setText] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [speaking, setSpeaking] = useState(false);
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
        if (canSpeak) {
          setSpeaking(true);
          speak(briefing, () => setSpeaking(false));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => () => stopSpeak(), []);

  const close = () => { stopSpeak(); setSpeaking(false); setVisible(false); };
  const replay = () => { if (!text) return; setSpeaking(true); speak(text, () => setSpeaking(false)); };

  if (!visible || !text) return null;

  return (
    <div className="briefing">
      <div className={`briefing-orb ${speaking ? "speaking" : ""}`}>
        <span className="core-glow" /><span className="core-ring" />
        <Logo size={30} />
      </div>
      <div className="briefing-body">
        <div className="briefing-name">Jarvis {speaking && <span className="briefing-wave"><span></span><span></span><span></span><span></span></span>}</div>
        <p>{text}</p>
      </div>
      <div className="briefing-actions">
        {canSpeak && <button title="Ouvir de novo" onClick={replay}>🔊</button>}
        <button title="Fechar" onClick={close}>×</button>
      </div>
    </div>
  );
}
