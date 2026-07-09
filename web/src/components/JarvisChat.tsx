import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import FocusAsset from "./FocusAsset";
import { sendChat, type ChatFocus } from "../api";
import {
  canSpeak, speak, stopSpeak, canListen, listen, ptVoices,
  getChosenVoiceName, setChosenVoiceName, type Listener,
} from "../voice";

interface Msg { role: "user" | "assistant"; content: string; }
type State = "idle" | "listening" | "thinking" | "speaking";

const GREETING = "Jarvis online. Fale ou digite — pergunte sobre qualquer moeda ou ação e eu mostro na tela.";

export default function JarvisChat() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [voiceOn, setVoiceOn] = useState(true);
  const [listenMode, setListenMode] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [interim, setInterim] = useState("");
  const [input, setInput] = useState("");
  const [focus, setFocus] = useState<ChatFocus | null>(null);
  const [voiceName, setVoiceName] = useState(getChosenVoiceName());

  const bodyRef = useRef<HTMLDivElement>(null);
  const listenerRef = useRef<Listener | null>(null);
  const listenModeRef = useRef(false);
  const voiceOnRef = useRef(true);
  const busyRef = useRef(false);

  useEffect(() => { listenModeRef.current = listenMode; }, [listenMode]);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, state, focus]);
  useEffect(() => () => { stopSpeak(); listenerRef.current?.stop(); }, []);

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
      if (voiceOnRef.current && canSpeak) {
        setState("speaking");
        speak(reply, () => { setState("idle"); busyRef.current = false; if (listenModeRef.current) startListen(); });
      } else {
        setState("idle");
        busyRef.current = false;
        if (listenModeRef.current) startListen();
      }
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Falha ao responder." }]);
      setState("idle");
      busyRef.current = false;
    }
  };

  const startListen = () => {
    if (!canListen || busyRef.current) return;
    stopSpeak();
    setState("listening");
    setInterim("");
    listenerRef.current = listen({
      continuous: false,
      onResult: (t, isFinal) => {
        setInterim(t);
        if (isFinal && t) {
          listenerRef.current?.stop();
          handleUserText(t);
        }
      },
      onEnd: () => {
        setInterim("");
        // se ninguém falou e o modo escuta segue ligado, reabre em seguida
        if (!busyRef.current) {
          setState("idle");
          if (listenModeRef.current) setTimeout(() => { if (listenModeRef.current && !busyRef.current) startListen(); }, 400);
        }
      },
    });
  };

  const stopListen = () => { listenerRef.current?.stop(); setState("idle"); setInterim(""); };

  const toggleListenMode = () => {
    const on = !listenMode;
    setListenMode(on);
    listenModeRef.current = on;
    if (on) startListen();
    else stopListen();
  };

  const stateLabel = { idle: "Pronto", listening: "Ouvindo…", thinking: "Pensando…", speaking: "Falando…" }[state];

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
              {canSpeak && ptVoices().length > 0 && (
                <select className="voice-select" value={voiceName} title="Escolher voz"
                  onChange={(e) => { setVoiceName(e.target.value); setChosenVoiceName(e.target.value); }}>
                  <option value="">Voz automática</option>
                  {ptVoices().map((v) => <option key={v.name} value={v.name}>{v.name.replace("Microsoft ", "")}</option>)}
                </select>
              )}
              {canSpeak && (
                <button className={voiceOn ? "on" : ""} title="Voz do Jarvis" onClick={() => { setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }}>
                  {voiceOn ? "🔊" : "🔈"}
                </button>
              )}
              <button title="Fechar" onClick={() => { stopSpeak(); stopListen(); setOpen(false); }}>×</button>
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
              <button className={`mic-btn ${state === "listening" ? "on" : ""}`}
                title="Segure para falar" onClick={() => (state === "listening" ? stopListen() : startListen())}>
                🎤
              </button>
            )}
            {canListen && (
              <button className={`listen-mode ${listenMode ? "on" : ""}`} onClick={toggleListenMode} title="Modo conversa contínua (ativa por voz)">
                {listenMode ? "● conversa" : "conversa por voz"}
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
