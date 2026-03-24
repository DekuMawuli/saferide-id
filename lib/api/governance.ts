import { apiFetch } from '@/lib/api/client';
import type {
  OperatorListItem,
  OperatorRead,
  OperatorVehicleBindingListItem,
  OperatorVehicleBindingRead,
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

export async function fetchVehicles(): Promise<VehicleRead[]> {
  return apiFetch<VehicleRead[]>('/vehicles');
}

export async function createVehicle(
  plate: string,
  displayName?: string | null,
): Promise<VehicleRead> {
  return apiFetch<VehicleRead>('/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plate,
      display_name: displayName || null,
    }),
  });
}

export async function fetchOperatorVehicleBindings(
  operatorId: string,
): Promise<OperatorVehicleBindingListItem[]> {
  return apiFetch<OperatorVehicleBindingListItem[]>(
    `/operators/${operatorId}/vehicle-bindings`,
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
