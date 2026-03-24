/**
 * Browser app origin for QR deep links (verify flow).
 * Prefer NEXT_PUBLIC_APP_URL so QR works when printed from a device.
 */
export function getPublicAppOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '') ?? '';
  if (env) return env;
  if (typeof window !== 'undefined') return window.location.origin;
  return '';
}
