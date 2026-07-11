// Ativa as notificações push NESTE aparelho: pede permissão, inscreve no
// PushManager com a chave VAPID do servidor e registra a inscrição lá.

import { getVapidKey, savePushSubscription } from "./api";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export const pushSupported = () =>
  typeof navigator !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export async function pushStatus(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return false;
  return !!(await reg.pushManager.getSubscription());
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "Este navegador não suporta notificações push." };

  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { ok: false, reason: "As notificações ficam disponíveis no app publicado (HTTPS). No preview local elas não ativam." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permissão de notificação negada." };

  const { publicKey } = await getVapidKey();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }
  await savePushSubscription(sub.toJSON());
  return { ok: true };
}
