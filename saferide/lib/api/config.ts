/**
 * Backend base URL for browser calls.
 * Must match the host your FastAPI app uses (see backend/.env HOST/PORT).
 */
export function getApiBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() ?? '';
  return raw.replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}
