import { apiFetch } from '@/lib/api/client';
import type {
  OperatorListItem,
  OperatorRead,
  CorporateBodyRead,
  AuthStartResponse,
  ESignetDebugRead,
  OperatorVehicleBindingListItem,
  OperatorVehicleBindingRead,
  VehicleListItem,
  VehicleRead,
} from '@/lib/api/types';

export async function fetchOperatorsList(params?: {
  status?: string;
  q?: string;
  limit?: number;
}): Promise<OperatorListItem[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.q) qs.set('q', params.q);
  if (params?.limit) qs.set('limit', String(params.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<OperatorListItem[]>(`/operators${suffix}`);
}

export async function fetchOperatorProfile(operatorId: string): Promise<OperatorRead> {
  return apiFetch<OperatorRead>(`/operators/${operatorId}`);
}

export async function fetchOperatorEsignetDebug(operatorId: string): Promise<ESignetDebugRead> {
  return apiFetch<ESignetDebugRead>(`/operators/${operatorId}/esignet-debug`);
}

export async function patchOperatorStatus(
  operatorId: string,
  status: string,
): Promise<OperatorRead> {
  return apiFetch<OperatorRead>(`/operators/${operatorId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

export async function patchOperatorProfile(
  operatorId: string,
  body: { full_name?: string | null; email?: string | null },
): Promise<OperatorRead> {
  return apiFetch<OperatorRead>(`/operators/${operatorId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchVehicles(): Promise<VehicleListItem[]> {
  return apiFetch<VehicleListItem[]>('/vehicles');
}

export async function createVehicle(body: {
  plate: string;
  display_name?: string | null;
  vehicle_type?: string | null;
  make_model?: string | null;
  color?: string | null;
  corporate_body_id?: string | null;
}): Promise<VehicleRead> {
  return apiFetch<VehicleRead>('/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plate: body.plate,
      display_name: body.display_name ?? null,
      vehicle_type: body.vehicle_type ?? null,
      make_model: body.make_model ?? null,
      color: body.color ?? null,
      corporate_body_id: body.corporate_body_id ?? null,
    }),
  });
}

export async function updateVehicle(
  vehicleId: string,
  body: {
    plate?: string;
    display_name?: string | null;
    vehicle_type?: string | null;
    make_model?: string | null;
    color?: string | null;
    corporate_body_id?: string | null;
  },
): Promise<VehicleRead> {
  return apiFetch<VehicleRead>(`/vehicles/${encodeURIComponent(vehicleId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function fetchOperatorVehicleBindings(
  operatorId: string,
): Promise<OperatorVehicleBindingListItem[]> {
  return apiFetch<OperatorVehicleBindingListItem[]>(
    `/operators/${operatorId}/vehicle-bindings`,
  );
}

export type OperatorRideEventRow = {
  id: string;
  operator_id: string;
  verify_short_code: string;
  channel: string;
  passenger_msisdn: string | null;
  event_type: string;
  consent_request_id: string | null;
  recorded_at: string;
};

export async function fetchOperatorRideEvents(
  operatorId: string,
  limit = 100,
): Promise<OperatorRideEventRow[]> {
  const qs = new URLSearchParams({ limit: String(limit) });
  return apiFetch<OperatorRideEventRow[]>(
    `/operators/${operatorId}/ride-events?${qs}`,
  );
}

export async function bindVehicleToOperator(
  operatorId: string,
  vehicleId: string,
): Promise<OperatorVehicleBindingRead> {
  return apiFetch<OperatorVehicleBindingRead>(
    `/operators/${operatorId}/vehicle-bindings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vehicle_id: vehicleId }),
    },
  );
}

export async function patchBindingActive(
  bindingId: string,
  isActive: boolean,
): Promise<OperatorVehicleBindingRead> {
  return apiFetch<OperatorVehicleBindingRead>(`/bindings/${bindingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: isActive }),
  });
}

export async function enrollOperator(body: {
  email?: string | null;
  password?: string | null;
  full_name?: string | null;
  phone: string;
  role: 'passenger';
}) {
  return apiFetch('/operators/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function startPassengerEsignetOnboarding(operatorId: string): Promise<AuthStartResponse> {
  return apiFetch<AuthStartResponse>(`/operators/${operatorId}/onboarding/esignet/start`, {
    method: 'POST',
  });
}

export async function startOfficerEsignetOnboarding(): Promise<AuthStartResponse> {
  return apiFetch<AuthStartResponse>('/operators/onboarding/esignet/start', {
    method: 'POST',
  });
}

export async function completeOfficerEsignetOnboarding(code: string, nonce: string): Promise<OperatorRead> {
  return apiFetch<OperatorRead>('/operators/onboarding/esignet/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, nonce }),
  });
}

export async function fetchCorporateBodies(): Promise<CorporateBodyRead[]> {
  return apiFetch<CorporateBodyRead[]>('/corporate-bodies');
}

export async function createCorporateBody(body: {
  name: string;
  code?: string | null;
  description?: string | null;
}): Promise<CorporateBodyRead> {
  return apiFetch<CorporateBodyRead>('/corporate-bodies', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function attachOfficerToCorporate(corporateId: string, officerId: string): Promise<OperatorRead> {
  return apiFetch<OperatorRead>(`/corporate-bodies/${corporateId}/officers/${officerId}`, {
    method: 'POST',
  });
}
