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

export function bestPtVoice(): SpeechSynthesisVoice | null {
  if (!voices.length) loadVoices();
  const pt = voices.filter((v) => v.lang.toLowerCase().startsWith("pt"));
  return (
    pt.find((v) => /natural|online|multilingual/i.test(v.name)) || // vozes neurais
    pt.find((v) => v.lang.toLowerCase() === "pt-br") ||
    pt[0] ||
    null
  );
}

export function speak(text: string, onEnd?: () => void) {
  if (!canSpeak) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "pt-BR";
  u.rate = 1.03;
  u.pitch = 1.0;
  const v = bestPtVoice();
  if (v) u.voice = v;
  if (onEnd) {
    u.onend = onEnd;
    u.onerror = onEnd;
  }
  window.speechSynthesis.speak(u);
}

export function stopSpeak() {
  if (canSpeak) window.speechSynthesis.cancel();
}
