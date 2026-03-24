import { getApiBaseUrl } from '@/lib/api/config';
import type { AuthMeResponse } from '@/lib/api/types';

export const SAFERIDE_ACCESS_TOKEN_KEY = 'saferide_access_token';

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

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }
  const { token, headers: initHeaders, ...rest } = init;
  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const auth = token !== undefined ? token : getStoredToken();
  if (auth) headers.set('Authorization', `Bearer ${auth}`);

  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, { ...rest, headers });

  if (!res.ok) {
    const text = await res.text();
    throw new ApiError(
      text || res.statusText || 'Request failed',
      res.status,
      text,
    );
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
