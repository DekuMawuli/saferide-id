import { apiFetch } from '@/lib/api/client';

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
  created_at: string;
  updated_at: string;
};

export async function fetchMyCredentials(): Promise<CredentialRecord[]> {
  return apiFetch<CredentialRecord[]>('/credentials/my');
}

/**
 * Build an OpenID4VCI credential-offer deep link for Inji Wallet.
 * The wallet receives this URL, discovers the issuer metadata, then
 * starts an authorization_code flow with eSignet to obtain the VC.
 */
export function buildWalletDeepLink(
  certifyBaseUrl: string,
  credentialType: string,
): string {
  const offer = {
    credential_issuer: `${certifyBaseUrl}/v1/certify`,
    credentials: [credentialType],
  };
  const encoded = encodeURIComponent(JSON.stringify(offer));
  return `openid-credential-offer://?credential_offer=${encoded}`;
}
