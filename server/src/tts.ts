// Voz premium via ElevenLabs (opcional). Usa o modelo flash (metade da cota,
// baixa latência, suporta português). A chave fica só no servidor.
// Se não houver ELEVENLABS_KEY, o app usa a voz nativa do navegador.

const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "Jx7J2Fi5Ssla82TsW3YE";
const MODEL = "eleven_flash_v2_5";

export const ttsAvailable = () => Boolean(process.env.ELEVENLABS_KEY);

export async function synthesize(text: string): Promise<Buffer> {
  const key = process.env.ELEVENLABS_KEY;
  if (!key) throw new Error("ELEVENLABS_KEY não configurada");

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 2000), // trava de segurança de cota
      model_id: MODEL,
      voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
  });

  if (!res.ok) {
    // 401/429 = cota esgotada ou chave inválida → o cliente cai pra voz do navegador
    throw new Error(`ElevenLabs HTTP ${res.status}`);
  }
  const arr = await res.arrayBuffer();
  return Buffer.from(arr);
}
