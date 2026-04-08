import { apiFetch } from '@/lib/api/client';

export type CredentialClaimLinks = {
  credential_configuration_id: string;
  credential_issuer: string;
  issuer_metadata_url: string;
  wallet_deep_link: string;
  inji_web_url: string | null;
};

export type CredentialRecord = {
  id: string;
  operator_id: string;
  vehicle_id: string | null;
  credential_type: string;
  issuer: string;
  external_credential_id: string | null;
  template_name: string | null;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  raw_reference: string | null;
  claim_links: CredentialClaimLinks | null;
  created_at: string;
  updated_at: string;
};

export async function fetchMyCredentials(): Promise<CredentialRecord[]> {
  return apiFetch<CredentialRecord[]>('/credentials/my');
}
