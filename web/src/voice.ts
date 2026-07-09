// Voz do Jarvis via Web Speech API (nativa do navegador, grátis).
// Prefere vozes neurais "Natural"/"Online" em pt-BR (bem melhores que a padrão)
// — disponíveis principalmente no Edge/Chrome no Windows.

export const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() {
  if (canSpeak) voices = window.speechSynthesis.getVoices();
}
if (canSpeak) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function ptVoices(): SpeechSynthesisVoice[] {
  if (!voices.length) loadVoices();
  return voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
}

export function bestPtVoice(): SpeechSynthesisVoice | null {
  const pt = ptVoices();
  return (
    pt.find((v) => /natural|online|multilingual/i.test(v.name)) || // vozes neurais
    pt.find((v) => v.lang.toLowerCase() === "pt-br") ||
    pt[0] ||
    null
  );
}

// voz escolhida pelo usuário (nome), persistida
const VKEY = "jarvis_voice";
export const getChosenVoiceName = () => localStorage.getItem(VKEY) || "";
export const setChosenVoiceName = (name: string) => localStorage.setItem(VKEY, name);

function resolveVoice(): SpeechSynthesisVoice | null {
  const chosen = getChosenVoiceName();
  if (chosen) {
    const v = voices.find((x) => x.name === chosen);
    if (v) return v;
  }
  return bestPtVoice();
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  // quebra em frases pra fluir melhor (evita a voz "travar" em textos longos)
  const parts = text.match(/[^.!?]+[.!?]*/g) || [text];
  parts.forEach((part, i) => {
    const u = new SpeechSynthesisUtterance(part.trim());
    u.lang = "pt-BR";
    u.rate = 1.02;
    u.pitch = 1.0;
    const v = resolveVoice();
    if (v) u.voice = v;
    if (i === parts.length - 1 && onEnd) {
      u.onend = onEnd;
      u.onerror = onEnd;
    }
    window.speechSynthesis.speak(u);
  });
}

export function stopSpeak() {
  if (canSpeak) window.speechSynthesis.cancel();
}

// ---- reconhecimento de fala (ouvir o usuário) ----
type SR = typeof window & { SpeechRecognition?: any; webkitSpeechRecognition?: any };
const SRClass = typeof window !== "undefined" ? (window as SR).SpeechRecognition || (window as SR).webkitSpeechRecognition : undefined;
export const canListen = !!SRClass;

export interface Listener { stop: () => void; }

export function listen(opts: {
  continuous?: boolean;
  onResult: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
}): Listener {
  if (!SRClass) return { stop: () => {} };
  const rec = new SRClass();
  rec.lang = "pt-BR";
  rec.continuous = opts.continuous ?? false;
  rec.interimResults = true;
  rec.onresult = (e: any) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) opts.onResult(r[0].transcript.trim(), true);
      else interim += r[0].transcript;
    }
    if (interim) opts.onResult(interim.trim(), false);
  };
  rec.onend = () => opts.onEnd?.();
  try { rec.start(); } catch { /* já rodando */ }
  return { stop: () => { try { rec.stop(); } catch { /* noop */ } } };
}
