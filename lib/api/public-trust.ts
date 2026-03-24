import { apiFetchPublic, apiFetchPublicRequest } from '@/lib/api/client';
import type { TrustPublicResponse } from '@/lib/api/types';

export async function fetchTrustByCode(
  code: string,
  opts?: { tier?: 'minimal' | 'standard' | 'extended'; disclosureToken?: string },
): Promise<TrustPublicResponse> {
  const c = encodeURIComponent(code.trim());
  const qs = new URLSearchParams();
  if (opts?.tier) qs.set('tier', opts.tier);
  if (opts?.disclosureToken) qs.set('disclosure_token', opts.disclosureToken);
  const q = qs.toString();
  return apiFetchPublic<TrustPublicResponse>(`/public/trust/${c}${q ? `?${q}` : ''}`);
}

export async function createConsentRequest(body: {
  verify_short_code: string;
  channel?: string;
  passenger_msisdn?: string | null;
}): Promise<{ request_id: string; expires_at: string; poll_url_hint: string }> {
  return apiFetchPublicRequest('/public/consent/request', {
    method: 'POST',
    json: {
      verify_short_code: body.verify_short_code,
      channel: body.channel ?? 'web',
      passenger_msisdn: body.passenger_msisdn ?? null,
    },
  });
}

export async function pollConsentStatus(requestId: string): Promise<Record<string, unknown>> {
  return apiFetchPublic(`/public/consent/status/${encodeURIComponent(requestId)}`);
}

export async function postEmergencyShare(body: {
  verify_short_code: string;
  sender_msisdn?: string | null;
  note?: string | null;
}): Promise<{ share_id: string; verify_short_code: string | null; sms_simulated_count: number }> {
  return apiFetchPublicRequest('/public/emergency/share', { method: 'POST', json: body });
}

export async function postPublicReport(body: {
  operator_code?: string | null;
  incident_type: string;
  details: string;
  location?: string | null;
  contact?: string | null;
}): Promise<{ report_id: string; ok: boolean }> {
  return apiFetchPublicRequest('/public/report', { method: 'POST', json: body });
}

export type UssdSimResponse = {
  session_id: string;
  continue_session: boolean;
  message: string;
};

export async function postUssdSimTurn(body: {
  msisdn: string;
  session_id?: string | null;
  input: string;
}): Promise<UssdSimResponse> {
  return apiFetchPublicRequest('/public/simulate/ussd', { method: 'POST', json: body });
}

export type SimSmsRow = {
  id: string;
  to: string;
  body: string;
  tag: string;
  created_at: string;
};

export async function fetchSimSmsOutbox(limit = 100, opts?: { to?: string }): Promise<SimSmsRow[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (opts?.to?.trim()) qs.set('to', opts.to.trim());
  return apiFetchPublic<SimSmsRow[]>(`/public/simulate/sms?${qs}`);
}

export async function postSimSms(body: {
  to_address: string;
  body: string;
  tag?: string;
}): Promise<{ id: string; ok: boolean }> {
  return apiFetchPublicRequest('/public/simulate/sms', {
    method: 'POST',
    json: { to_address: body.to_address, body: body.body, tag: body.tag ?? 'manual' },
  });
}
