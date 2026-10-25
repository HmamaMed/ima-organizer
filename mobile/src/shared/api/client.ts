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
let onScopeChange: (() => void) | null = null;
export function setScopeChangeHandler(handler: (() => void) | null): void { onScopeChange = handler; }
let recoverAuthentication: ((token: string) => Promise<string | null>) | null = null;
let scopeProvider: (() => string | null) | null = null;
export function setAuthenticationRecovery(handler: ((token: string) => Promise<string | null>) | null): void { recoverAuthentication = handler; }
export function setCoupleScopeProvider(provider: (() => string | null) | null): void { scopeProvider = provider; }

let onUnauthorized: ((token?: string) => void) | null = null;

export function setUnauthorizedHandler(handler: ((token?: string) => void) | null): void {
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
  options: { method?: string; body?: unknown; token?: string | null; headers?: Record<string, string> } = {},
): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const scope = scopeProvider?.();
  if (token && scope) headers['X-Couple-Id'] = scope;
  const request = { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined };
  let response = await fetch(`${API_BASE_URL}${path}`, request);
  // A 401 is rejected before application code runs. Only this known authentication failure may be replayed.
  if (response.status === 401 && token && recoverAuthentication) {
    const renewed = await recoverAuthentication(token);
    if (renewed) { headers.Authorization = `Bearer ${renewed}`; response = await fetch(`${API_BASE_URL}${path}`, request); }
  }

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
    if (response.status === 401) onUnauthorized?.(token ?? undefined);
    if (response.status === 403 && /^\/api\/(notes|memories|watchlist|inbox|recipes|wishes)(\/|$)/.test(path)) onScopeChange?.();
    if (response.status === 409 && message.startsWith('Your couple has changed.')) onScopeChange?.();
    throw new ApiError(response.status, message);
  }

  const payload = await response.text();
  return payload ? JSON.parse(payload) as T : undefined as T;
}

/** Multipart uploads use the same authentication and error handling as JSON calls. */
export async function apiUpload<T>(path: string, blob: Blob, token: string): Promise<T> {
  const form = new FormData();
  form.append('file', blob, 'memory-media');
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  const scope = scopeProvider?.();
  if (scope) headers['X-Couple-Id'] = scope;
  const request = { method: 'POST', headers, body: form };
  let response = await fetch(`${API_BASE_URL}${path}`, request);
  if (response.status === 401 && recoverAuthentication) {
    const renewed = await recoverAuthentication(token);
    if (renewed) { headers.Authorization = `Bearer ${renewed}`; response = await fetch(`${API_BASE_URL}${path}`, request); }
  }
  if (!response.ok) {
    let message = 'Could not upload this file. Please try again.';
    try { const data = await response.json(); if (data?.message) message = data.message; } catch { /* Keep the readable fallback. */ }
    if (response.status === 401) onUnauthorized?.(token ?? undefined);
    if (response.status === 403 || (response.status === 409 && message.startsWith('Your couple has changed.'))) onScopeChange?.();
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}
