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
  const [state, setState] = useState<State>({
    me: null,
    loading: false,
    error: null,
  });
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(Boolean(getAccessToken()));
  }, []);

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

  const saveToken = useCallback(
    (token: string | null) => {
      setAccessToken(token);
      setHasToken(Boolean(token));
      void refresh();
    },
    [refresh],
  );

  const signOut = useCallback(() => {
    setAccessToken(null);
    setHasToken(false);
    setState({ me: null, loading: false, error: null });
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
