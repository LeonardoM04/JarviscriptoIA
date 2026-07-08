import { useEffect, useState } from "react";
import Logo from "./Logo";

const BOOT_LINES = [
  "Inicializando núcleo Jarvis…",
  "Conectando aos mercados…",
  "Calibrando indicadores e ciclos…",
  "Pronto.",
];

export default function Splash({ onDone }: { onDone: () => void }) {
  const [line, setLine] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_LINES.forEach((_, i) => timers.push(setTimeout(() => setLine(i), 500 + i * 500)));
    timers.push(setTimeout(() => setLeaving(true), 2900));
    timers.push(setTimeout(onDone, 3500));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <div className={`splash ${leaving ? "leaving" : ""}`}>
      <div className="splash-grid" />
      <div className="splash-core">
        <div className="splash-logo">
          <span className="splash-ring" />
          <Logo size={140} />
        </div>
        <div className="splash-word">
          QUAD<span className="accent">₿</span>LOCK
        </div>
        <div className="splash-sub">CAPITAL</div>
        <div className="splash-boot">
          <span className="splash-cursor" /> {BOOT_LINES[line]}
        </div>
        <div className="splash-bar"><span style={{ width: `${((line + 1) / BOOT_LINES.length) * 100}%` }} /></div>
      </div>
    </div>
  );
}
