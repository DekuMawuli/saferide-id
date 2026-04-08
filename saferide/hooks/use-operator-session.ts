'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  fetchAuthMe,
  getAccessToken,
  setAccessToken,
} from '@/lib/api/client';
import type { AuthMeResponse } from '@/lib/api/types';
import { isApiConfigured } from '@/lib/api/config';

type State = {
  me: AuthMeResponse | null;
  loading: boolean;
  error: string | null;
};

export function useOperatorSession() {
  // Always start loading=true so the redirect gate in RoleGate never fires prematurely.
  // On SSR, window is undefined and getAccessToken() returns null — if we used that as
  // the initial value we'd get loading=false/hasToken=false on the first render, which
  // causes RoleGate's redirect effect to fire before refresh() has read localStorage.
  const [state, setState] = useState<State>({
    me: null,
    loading: true,
    error: null,
  });
  const [hasToken, setHasToken] = useState(false);

  const refresh = useCallback(async () => {
    if (!isApiConfigured()) {
      setState({ me: null, loading: false, error: null });
      return;
    }
    if (!getAccessToken()) {
      setState({ me: null, loading: false, error: null });
      setHasToken(false);
      return;
    }
    setHasToken(true);
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const me = await fetchAuthMe();
      setState({ me, loading: false, error: null });
      setHasToken(Boolean(getAccessToken()));
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? `${e.status}: ${e.message}`
          : e instanceof Error
            ? e.message
            : 'Failed to load session';
      setState({ me: null, loading: false, error: msg });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onToken = () => void refresh();
    window.addEventListener('saferide-token-updated', onToken);
    return () => window.removeEventListener('saferide-token-updated', onToken);
  }, [refresh]);

  // Re-check session when browser restores page from bfcache (back/forward navigation).
  // Without this, the page stays stuck in `loading: true` because React doesn't remount.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) void refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [refresh]);

  const saveToken = useCallback(
    (token: string | null) => {
      setAccessToken(token);
      setHasToken(Boolean(token));
      void refresh();
    },
    [refresh],
  );

  const signOut = useCallback((redirectTo = '/') => {
    setAccessToken(null);
    setHasToken(false);
    setState({ me: null, loading: false, error: null });
    window.location.href = redirectTo;
  }, []);

  return {
    ...state,
    refresh,
    saveToken,
    signOut,
    hasToken,
    apiConfigured: isApiConfigured(),
  };
}
