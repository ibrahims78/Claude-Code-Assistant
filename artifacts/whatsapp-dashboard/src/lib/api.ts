const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function getApiBase() {
  if (import.meta.env.PROD) return "/api";
  const devDomain = (import.meta as any).env.VITE_API_URL;
  if (devDomain) return devDomain + "/api";
  return "/api";
}

export function getSocketBase() {
  if (import.meta.env.PROD) return "";
  const devDomain = (import.meta as any).env.VITE_API_URL;
  if (devDomain) return devDomain;
  return "";
}

const API_BASE = getApiBase();

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as any).error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
