/**
 * Thin API client for the Spring Boot backend.
 *
 * The base URL is configurable via VITE_API_URL (defaults to the local dev
 * backend). On a real device this would point at the deployed backend URL.
 */
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

/**
 * Called whenever any request comes back 401 (no/invalid/expired token).
 * AuthContext registers its own `logout` here so a stale token stored on the
 * device can't leave the UI looking authenticated when the backend has
 * already rejected it.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Attaches the JWT (if present) and parses JSON responses. Throws ApiError on
 * non-2xx responses.
 */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore non-JSON error bodies
    }
    if (response.status === 401) {
      onUnauthorized?.();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
