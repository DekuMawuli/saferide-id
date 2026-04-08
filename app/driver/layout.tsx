'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { SidebarLayout } from '@/components/shared/sidebar-layout';
import { fetchMyConsentRequests } from '@/lib/api/consent-driver';
import { isApiConfigured } from '@/lib/api/config';
import { useOperatorSession } from '@/hooks/use-operator-session';
import type { ConsentRequestItem } from '@/lib/api/types';

interface DriverConsentsCtx {
  consentRequests: ConsentRequestItem[];
}

export const DriverConsentsContext = createContext<DriverConsentsCtx>({ consentRequests: [] });

export function useDriverConsents() {
  return useContext(DriverConsentsContext);
}

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const { hasToken } = useOperatorSession();
  const apiConfigured = isApiConfigured();
  const [consentRequests, setConsentRequests] = useState<ConsentRequestItem[]>([]);

  const refresh = useCallback(async () => {
    if (!hasToken || !apiConfigured) { setConsentRequests([]); return; }
    try {
      const rows = await fetchMyConsentRequests();
      // Stable update: only swap reference when IDs actually changed
      setConsentRequests(prev => {
        const prevIds = prev.map(r => r.id).join(',');
        const newIds = rows.map(r => r.id).join(',');
        return prevIds === newIds ? prev : rows;
      });
    } catch {
      setConsentRequests([]);
    }
  }, [hasToken, apiConfigured]);

  useEffect(() => {
    void refresh();
    if (!hasToken || !apiConfigured) return;
    const id = setInterval(() => void refresh(), 8_000);
    return () => clearInterval(id);
  }, [refresh, hasToken, apiConfigured]);

  return (
    <DriverConsentsContext.Provider value={{ consentRequests }}>
      <SidebarLayout role="driver" badgeCounts={{ '/driver/profile': consentRequests.length }}>
        {children}
      </SidebarLayout>
    </DriverConsentsContext.Provider>
  );
}
