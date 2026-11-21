export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

const TOKEN_KEY = "philippines_cities_token";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiOptions {
  method?: Method;
  body?: unknown;
  form?: Record<string, string>;
  formData?: FormData;
  auth?: boolean;
}

function extractError(data: unknown): string {
  if (!data || typeof data !== "object") {
    return "Something went wrong. Please try again.";
  }
  const detail = (data as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return null;
      })
      .filter((message): message is string => Boolean(message));
    if (messages.length > 0) return messages.join(", ");
  }
  return "Something went wrong. Please try again.";
}

export async function api<T>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const method: Method =
    options.method ??
    (options.body !== undefined || options.form || options.formData
      ? "POST"
      : "GET");
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = options.auth === false ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (options.form) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    payload = new URLSearchParams(options.form).toString();
  } else if (options.formData) {
    payload = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: payload,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      0,
      `Cannot reach the API at ${API_URL}. Make sure the backend is running.`,
    );
  }

  if (response.status === 401 && token) {
    clearToken();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("philippines-cities:unauthorized"));
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, extractError(data));
  }
  return data as T;
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
