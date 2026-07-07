// Senha compartilhada guardada no navegador e enviada em todo request.

const KEY = "jarvis_pwd";

export const getPassword = () => localStorage.getItem(KEY) || "";
export const setPassword = (p: string) => localStorage.setItem(KEY, p);
export const clearPassword = () => localStorage.removeItem(KEY);

export const authHeaders = (): Record<string, string> => {
  const p = getPassword();
  return p ? { "x-app-password": p } : {};
};

// dispara quando o servidor rejeita a senha (401) — o App volta pro login
export const onAuthFail = () => {
  clearPassword();
  window.dispatchEvent(new Event("auth-fail"));
};
