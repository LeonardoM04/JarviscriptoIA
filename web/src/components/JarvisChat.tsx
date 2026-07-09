import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import FocusAsset from "./FocusAsset";
import { sendChat, type ChatFocus } from "../api";
import { canListen, listen, type Listener } from "../voice";

interface Msg { role: "user" | "assistant"; content: string; }
type State = "idle" | "listening" | "thinking";

const GREETING = "Jarvis online. Fale, digite ou diga 'Ei Jarvis' — pergunte sobre qualquer moeda ou ação e eu mostro na tela.";
const CONVO_KEY = "jarvis_convo";

function loadConvo(): Msg[] {
  try {
    const s = JSON.parse(localStorage.getItem(CONVO_KEY) || "[]");
    return Array.isArray(s) && s.length ? s : [{ role: "assistant", content: GREETING }];
  } catch {
    return [{ role: "assistant", content: GREETING }];
  }
}

export default function JarvisChat() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [wakeOn, setWakeOn] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(loadConvo);
  const [interim, setInterim] = useState("");
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState<ChatFocus | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const cmdRef = useRef<Listener | null>(null);
  const wakeRef = useRef<Listener | null>(null);
  const wakeOnRef = useRef(false);
  const busyRef = useRef(false);
  const openRef = useRef(false);
  const stateRef = useRef<State>("idle");

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { wakeOnRef.current = wakeOn; }, [wakeOn]);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { localStorage.setItem(CONVO_KEY, JSON.stringify(messages.slice(-50))); }, [messages]);
  useEffect(() => { bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" }); }, [messages, state, focus]);
  useEffect(() => () => { cmdRef.current?.stop(); wakeRef.current?.stop(); }, []);

  const handleUserText = async (text: string) => {
    if (!text.trim() || busyRef.current) return;
    busyRef.current = true;
    setInterim("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setState("thinking");
    try {
      const { reply, focus: f } = await sendChat(next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (f) setFocus(f);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Falha ao responder." }]);
    } finally {
      setState("idle");
      busyRef.current = false;
      if (wakeOnRef.current) setTimeout(startWake, 500); // volta a ouvir o "Ei Jarvis"
    }
  };

  // ---- entrada por microfone (push-to-talk) ----
  const startCommand = () => {
    if (!canListen || busyRef.current) return;
    wakeRef.current?.stop();
    setState("listening");
    setInterim("");
    cmdRef.current = listen({
      continuous: false,
      onResult: (t, isFinal) => {
        setInterim(t);
        if (isFinal && t) { cmdRef.current?.stop(); handleUserText(t); }
      },
      onEnd: () => { setInterim(""); if (!busyRef.current) { setState("idle"); if (wakeOnRef.current) setTimeout(startWake, 400); } },
    });
  };
  const stopCommand = () => { cmdRef.current?.stop(); setState("idle"); setInterim(""); };

  // ---- wake word: "Ei Jarvis" ----
  const startWake = () => {
    if (!canListen || !wakeOnRef.current || busyRef.current || stateRef.current === "listening") return;
    wakeRef.current = listen({
      continuous: true,
      onResult: (t) => {
        if (/\b(ei )?jarvis\b/i.test(t)) {
          wakeRef.current?.stop();
          if (!openRef.current) setOpen(true);
          setTimeout(startCommand, 250);
        }
      },
      onEnd: () => { if (wakeOnRef.current && !busyRef.current && stateRef.current !== "listening") setTimeout(startWake, 500); },
    });
  };
  const toggleWake = () => {
    const on = !wakeOn;
    setWakeOn(on); wakeOnRef.current = on;
    if (on) { if (!open) setOpen(true); startWake(); } else { wakeRef.current?.stop(); }
  };

  const clearConvo = () => {
    const g = [{ role: "assistant" as const, content: GREETING }];
    setMessages(g); setFocus(null);
    localStorage.setItem(CONVO_KEY, JSON.stringify(g));
  };

  const stateLabel = { idle: wakeOn ? "Ouvindo 'Ei Jarvis'" : "Pronto", listening: "Ouvindo…", thinking: "Pensando…" }[state];

  return (
    <>
      <button className={`jarvis-orb ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} title="Abrir o Jarvis">
        <span className="orb-ring" />
        <Logo size={30} />
      </button>

      {open && (
        <div className="jarvis-brain">
          <div className="jbrain-head">
            <div className="jchat-title"><Logo size={22} /> <span>Jarvis</span> <span className="jchat-live">{stateLabel}</span></div>
            <div className="jchat-actions">
              <button title="Limpar conversa" onClick={clearConvo}>🗑</button>
              <button title="Fechar" onClick={() => { stopCommand(); wakeRef.current?.stop(); setOpen(false); }}>×</button>
            </div>
          </div>

          <div className={`jbrain-core ${state}`}>
            <span className="core-glow" /><span className="core-ring" /><span className="core-ring r2" />
            <Logo size={64} />
          </div>

          <div className="jbrain-body" ref={bodyRef}>
            {messages.map((m, i) => <div key={i} className={`jmsg ${m.role}`}>{m.content}</div>)}
            {interim && <div className="jmsg user interim">{interim}</div>}
            {state === "thinking" && <div className="jmsg assistant jtyping"><span></span><span></span><span></span></div>}
            {focus && <FocusAsset focus={focus} />}
          </div>

          <div className="jbrain-controls">
            {canListen && (
              <button className={`mic-btn ${state === "listening" ? "on" : ""}`} title="Segure para falar" onClick={() => (state === "listening" ? stopCommand() : startCommand())}>🎤</button>
            )}
            {canListen && (
              <button className={`listen-mode ${wakeOn ? "on" : ""}`} onClick={toggleWake} title="Ativar por voz dizendo 'Ei Jarvis'">
                {wakeOn ? "● Ei Jarvis" : "Ei Jarvis"}
              </button>
            )}
            <form className="jbrain-input" onSubmit={(e) => { e.preventDefault(); handleUserText(input); }}>
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao Jarvis…" />
              <button type="submit" disabled={!input.trim()}>➤</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
