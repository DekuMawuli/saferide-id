'use client';

import { useEffect, useRef } from 'react';
import { setAccessToken } from '@/lib/api/client';

/**
 * After eSignet, the API redirects to this app with `#access_token=...&role=...`.
 * Capture once, persist token, strip the fragment (no full page reload).
 */
export function OauthFragmentHandler() {
  const done = useRef(false);

  useEffect(() => {
    if (done.current || typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    if (!token) return;
    done.current = true;
    setAccessToken(token);
    const path = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new Event('saferide-token-updated'));
  }, []);

  return null;
}
