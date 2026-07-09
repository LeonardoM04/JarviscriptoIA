import { useEffect, useRef, useState } from "react";
import Logo from "./Logo";
import { sendChat } from "../api";
import { canSpeak, speak, stopSpeak } from "../voice";

interface Msg { role: "user" | "assistant"; content: string; }

const GREETING = "Jarvis online. Pergunte sobre qualquer moeda, ação ou o mercado — estou de olho em tudo.";

export default function JarvisChat() {
  const [open, setOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: "assistant", content: GREETING }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => stopSpeak(), []);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const { reply } = await sendChat(next);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (voiceOn) speak(reply);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? e.message : "Falha ao responder." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className={`jarvis-orb ${open ? "hidden" : ""}`} onClick={() => setOpen(true)} title="Falar com o Jarvis">
        <span className="orb-ring" />
        <Logo size={30} />
      </button>

      {open && (
        <div className="jarvis-chat">
          <div className="jchat-head">
            <div className="jchat-title"><Logo size={22} /> <span>Jarvis</span> <span className="jchat-live">online</span></div>
            <div className="jchat-actions">
              {canSpeak && (
                <button className={voiceOn ? "on" : ""} title="Voz ao responder" onClick={() => { setVoiceOn((v) => { if (v) stopSpeak(); return !v; }); }}>
                  {voiceOn ? "🔊" : "🔈"}
                </button>
              )}
              <button title="Fechar" onClick={() => { stopSpeak(); setOpen(false); }}>×</button>
            </div>
          </div>

          <div className="jchat-body" ref={bodyRef}>
            {messages.map((m, i) => (
              <div key={i} className={`jmsg ${m.role}`}>{m.content}</div>
            ))}
            {loading && <div className="jmsg assistant jtyping"><span></span><span></span><span></span></div>}
          </div>

          <form className="jchat-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pergunte ao Jarvis…" autoFocus />
            <button type="submit" disabled={loading || !input.trim()}>➤</button>
          </form>
        </div>
      )}
    </>
  );
}
