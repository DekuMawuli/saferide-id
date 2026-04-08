'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api/client';
import {
  fetchCorporateBodies,
  fetchOperatorRideEvents,
  fetchOperatorVehicleBindings,
} from '@/lib/api/governance';
import type { CorporateBodyRead, OperatorRideEventRow, OperatorVehicleBindingListItem } from '@/lib/api/types';

type UseDriverDataOpts = {
  /** When set with token + API, loads bindings and ride events */
  operatorId: string | null | undefined;
  corporateBodyId: string | null | undefined;
  hasToken: boolean;
  apiConfigured: boolean;
};

/**
 * Fleet + activity data for driver routes. Pass fields from {@link useOperatorSession}
 * so we do not mount a second session hook in the same page.
 */
export function useDriverData(opts: UseDriverDataOpts) {
  const { operatorId, corporateBodyId, hasToken, apiConfigured } = opts;

  const [bindings, setBindings] = useState<OperatorVehicleBindingListItem[]>([]);
  const [rideEvents, setRideEvents] = useState<OperatorRideEventRow[]>([]);
  const [operatorAssociationName, setOperatorAssociationName] = useState<string | null>(null);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [fleetError, setFleetError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!operatorId || !hasToken || !apiConfigured) {
      setBindings([]);
      setRideEvents([]);
      setOperatorAssociationName(null);
      setFleetError(null);
      return;
    }
    setFleetLoading(true);
    setFleetError(null);
    try {
      const [b, ev, bodies] = await Promise.all([
        fetchOperatorVehicleBindings(operatorId),
        fetchOperatorRideEvents(operatorId, 50),
        corporateBodyId ? fetchCorporateBodies() : Promise.resolve([] as CorporateBodyRead[]),
      ]);
      setBindings(b);
      setRideEvents(ev);
      if (corporateBodyId && bodies.length) {
        const row = bodies.find((x) => x.id === corporateBodyId);
        setOperatorAssociationName(row?.name ?? null);
      } else {
        setOperatorAssociationName(null);
      }
    } catch (e) {
      setBindings([]);
      setRideEvents([]);
      setOperatorAssociationName(null);
      setFleetError(
        e instanceof ApiError ? `${e.status}: ${e.message}` : 'Could not load driver data',
      );
    } finally {
      setFleetLoading(false);
    }
  }, [operatorId, corporateBodyId, hasToken, apiConfigured]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeBinding = useMemo(
    () => bindings.find((b) => b.binding.is_active) ?? null,
    [bindings],
  );

  const associationLabel = useMemo(() => {
    const fromVehicle = activeBinding?.corporate_body_name?.trim();
    if (fromVehicle) return fromVehicle;
    return operatorAssociationName?.trim() || null;
  }, [activeBinding?.corporate_body_name, operatorAssociationName]);

  return {
    bindings,
    activeBinding,
    rideEvents,
    associationLabel,
    fleetLoading,
    fleetError,
    reload: load,
  };
}
