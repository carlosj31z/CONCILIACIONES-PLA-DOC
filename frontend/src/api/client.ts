const TOKEN_KEY = "conciliaciones_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  detalles?: unknown;
  constructor(status: number, message: string, detalles?: unknown) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? "Error inesperado", body.detalles);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /**
   * Sube un archivo como cuerpo binario en crudo. No usa FormData a
   * propósito: es un solo archivo por petición, y así el backend lo recibe
   * con express.raw sin necesitar una librería de multipart.
   */
  upload: <T>(path: string, archivo: File) =>
    request<T>(path, {
      method: "POST",
      body: archivo,
      // Se fija explícitamente para que el navegador no ponga el tipo del
      // archivo: express.json() no debe intentar parsear esto.
      headers: { "Content-Type": "application/octet-stream" },
    }),
};
