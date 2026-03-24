import { apiFetch } from '@/lib/api/client';
import type { ConsentRequestItem } from '@/lib/api/types';

export async function fetchMyConsentRequests(): Promise<ConsentRequestItem[]> {
  return apiFetch<ConsentRequestItem[]>('/auth/me/consent-requests');
}

export async function fetchMyConsentRequest(id: string): Promise<ConsentRequestItem> {
  return apiFetch<ConsentRequestItem>(`/auth/me/consent-requests/${encodeURIComponent(id)}`);
}

export async function respondConsentRequest(
  id: string,
  approve: boolean,
): Promise<{ status: string; disclosure_token: string | null; disclosure_token_expires_at: string | null }> {
  return apiFetch(`/auth/me/consent-requests/${encodeURIComponent(id)}/respond`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approve }),
  });
}
