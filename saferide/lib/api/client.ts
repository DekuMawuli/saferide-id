import { getApiBaseUrl } from '@/lib/api/config';
import type { AuthMeResponse, EsignetCallbackResponse, OperatorRead } from '@/lib/api/types';

export const SAFERIDE_ACCESS_TOKEN_KEY = 'saferide_access_token';
const DEFAULT_FETCH_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(SAFERIDE_ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(SAFERIDE_ACCESS_TOKEN_KEY, token);
  else localStorage.removeItem(SAFERIDE_ACCESS_TOKEN_KEY);
  window.dispatchEvent(new Event('saferide-token-updated'));
}

export function getAccessToken(): string | null {
  return getStoredToken();
}

/**
 * GET absolute URL for full-page navigation (eSignet OAuth cookie is set on API origin).
 */
export function getEsignetLoginUrl(): string {
  const base = getApiBaseUrl();
  if (!base) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  return `${base}/auth/esignet/login`;
}

function mergeAbortSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (active.length === 0) return undefined;
  if (active.length === 1) return active[0];

  const controller = new AbortController();
  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) controller.abort(reason);
  };

  for (const signal of active) {
    if (signal.aborted) {
      abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => abort(signal.reason), { once: true });
  }

  return controller.signal;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null; timeoutMs?: number } = {},
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { token, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const auth = token !== undefined ? token : getStoredToken();
  if (auth) headers.set('Authorization', `Bearer ${auth}`);

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'AbortError'));
  }, timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers,
      signal: mergeAbortSignals([rest.signal, timeoutController.signal]),
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError' && !rest.signal?.aborted
        ? `Request timed out after ${Math.ceil(timeoutMs / 1000)}s`
        : error instanceof Error
          ? error.message
          : 'Network request failed';
    throw new ApiError(message, 0);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText || 'Request failed';
    try {
      const json = JSON.parse(text);
      if (typeof json?.detail === 'string') message = json.detail;
      else if (typeof json?.message === 'string') message = json.message;
    } catch { /* non-JSON body — keep raw text */ }
    throw new ApiError(message, res.status, text);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/me', { method: 'GET' });
}

export async function postDriverLogin(phone: string, password: string): Promise<EsignetCallbackResponse> {
  return apiFetch<EsignetCallbackResponse>('/auth/driver/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    token: null,
    body: JSON.stringify({ phone, password }),
  });
}

export async function postAdminLogin(email: string, password: string): Promise<EsignetCallbackResponse> {
  return apiFetch<EsignetCallbackResponse>('/auth/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    token: null,
    body: JSON.stringify({ email, password }),
  });
}


export async function postAdminCreateUser(body: {
  email: string;
  password: string;
  full_name?: string | null;
  role: string;
}): Promise<OperatorRead> {
  return apiFetch<OperatorRead>('/auth/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function postOfficerCreateUser(body: {
  email: string;
  password: string;
  full_name?: string | null;
}) {
  return apiFetch('/auth/officers/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** JSON GET without Authorization (public endpoints). */
export async function apiFetchPublic<T>(path: string): Promise<T> {
  return apiFetchPublicRequest<T>(path, { method: 'GET' });
}

type PublicRequestInit = Omit<RequestInit, 'body'> & { json?: unknown };

/** Public API (no Bearer). Supports JSON body for POST. */
export async function apiFetchPublicRequest<T>(
  path: string,
  init: PublicRequestInit = {},
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const { json, headers: hInit, ...rest } = init;
  const headers = new Headers(hInit);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  let body: BodyInit | null | undefined;
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(json);
  }
  const res = await fetch(url, { ...rest, headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(text || res.statusText || 'Request failed', res.status, text);
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    return (await res.text()) as T;
  }
  return res.json() as Promise<T>;
}

export async function fetchOperator(operatorId: string) {
  return apiFetch(`/operators/${operatorId}`, { method: 'GET' });
}
