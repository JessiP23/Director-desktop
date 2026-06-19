/**
 * Authenticated HTTP client for the WM Studio backend.
 *
 * Every request carries the Supabase JWT as `Authorization: Bearer`. On a 401
 * it refreshes the session once and retries — so an expired access token is
 * transparent to callers. All endpoints are reached through `config.apiBaseUrl`.
 */
import { config } from "@/lib/config";
import { getAccessToken, supabase } from "@/lib/auth/supabase";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { body?: unknown };

async function authHeader(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** Absolute URL + auth headers for a backend path (used by the SSE reader too). */
export async function buildAuthorizedRequest(
  path: string,
): Promise<{ url: string; headers: Record<string, string> }> {
  return { url: `${config.apiBaseUrl}${path}`, headers: await authHeader() };
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, headers, ...rest } = options;
  const auth = await authHeader();

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...auth,
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Expired token: refresh once and retry.
  if (response.status === 401 && !isRetry) {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) return request<T>(path, options, true);
  }

  const text = await response.text();
  const parsed = text ? safeJson(text) : undefined;

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    if (parsed && typeof parsed === "object" && "error" in parsed) {
      message = String((parsed as { error: unknown }).error);
    }
    throw new ApiError(response.status, message, parsed);
  }

  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
