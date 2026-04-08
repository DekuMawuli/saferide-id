/**
 * Shapes aligned with FastAPI/Pydantic responses (`app/schemas`).
 * Adjust when backend schemas change.
 */

export type OperatorRead = {
  id: string;
  external_subject_id: string;
  full_name: string | null;
  email?: string | null;
  phone: string | null;
  photo_ref: string | null;
  individual_id?: string | null;
  gender?: string | null;
  birthdate?: string | null;
  registration_type?: string | null;
  auth_provider: string;
  acr: string | null;
  esignet_verified_at: string | null;
  status: string;
  verify_short_code?: string | null;
  role: string;
  corporate_body_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type OperatorListItem = {
  operator: OperatorRead;
  primary_vehicle_plate: string | null;
};

export type CorporateBodyRead = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type VehicleRead = {
  id: string;
  external_ref: string | null;
  display_name: string | null;
  vehicle_type?: string | null;
  make_model?: string | null;
  color?: string | null;
  corporate_body_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type BoundOperatorSummary = {
  id: string;
  full_name: string | null;
  phone: string | null;
  status: string;
  verify_short_code: string | null;
  binding_id: string;
  is_active: boolean;
};

export type VehicleListItem = {
  vehicle: VehicleRead;
  bound_operator: BoundOperatorSummary | null;
  corporate_body_name?: string | null;
};

export type OperatorVehicleBindingRead = {
  id: string;
  operator_id: string;
  vehicle_id: string;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type OperatorVehicleBindingListItem = {
  binding: OperatorVehicleBindingRead;
  plate: string | null;
  vehicle_display_name: string | null;
  vehicle_type?: string | null;
  make_model?: string | null;
  color?: string | null;
  corporate_body_name?: string | null;
  vehicle_updated_at?: string | null;
};

export type ESignetDebugRead = {
  operator_id: string;
  claims: Record<string, unknown>;
  userinfo: Record<string, unknown> | string | null;
  created_at: number;
};

export type TrustVehicleItem = {
  plate: string | null;
  display_name: string | null;
};

export type TrustPublicResponse = {
  disclosure_tier: 'minimal' | 'standard' | 'extended';
  operator_id: string | null;
  display_name: string | null;
  photo_url: string | null;
  phone: string | null;
  status: string;
  trust_band: 'CLEAR' | 'CAUTION' | 'BLOCK';
  vehicles: TrustVehicleItem[];
  esignet_verified_at: string | null;
  external_subject_hint: string | null;
  consent_request_id: string | null;
};

export type ConsentRequestItem = {
  id: string;
  operator_id: string;
  status: string;
  channel: string;
  verify_short_code: string;
  passenger_msisdn: string | null;
  expires_at: string;
  created_at: string;
};

export type AuthMeResponse = {
  authenticated: boolean;
  operator: OperatorRead | null;
  role: string | null;
  note: string | null;
};

export type AuthStartResponse = {
  authorization_url: string;
  state: string;
  expires_in: number;
};

export type EsignetCallbackResponse = {
  message?: string;
  operator: OperatorRead;
  access_token: string;
  refresh_token?: string | null;
  token_type: string;
  expires_in: number;
  refresh_expires_in?: number | null;
  role?: string;
  auth_provider?: string;
  id_token_verified?: boolean;
  redirect_to?: string;
};
