'use client';

import { useEffect, useRef } from 'react';

type ButtonConfig = {
  labelText?: string;
  shape?: 'sharp_edges' | 'soft_edges' | 'rounded_edges';
  theme?: 'outline' | 'filled_orange' | 'filled_black' | 'custom';
  type?: 'standard' | 'icon';
};

type OidcConfig = {
  acr_values?: string;
  authorizeUri: string;
  claims_locales?: string;
  client_id: string;
  display?: 'page' | 'popup' | 'touch' | 'wap';
  max_age?: number;
  nonce?: string;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  redirect_uri: string;
  scope: string;
  state?: string;
  ui_locales?: string;
  response_type?: 'code';
};

type Props = {
  id?: string;
  buttonConfig: ButtonConfig;
  oidcConfig: OidcConfig;
  style?: Record<string, string>;
};

export function SignInWithEsignet({ id, buttonConfig, oidcConfig, style }: Props) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;

    const initButton = async () => {
      const sdk = (
        window as Window & {
          SignInWithEsignetButton?: {
            init: (args: {
              signInElement: HTMLElement;
              buttonConfig: ButtonConfig;
              oidcConfig: OidcConfig;
              style?: Record<string, string>;
            }) => Promise<unknown>;
          };
        }
      ).SignInWithEsignetButton;

      if (!sdk?.init) {
        attempts += 1;
        if (!cancelled && attempts < maxAttempts) {
          window.setTimeout(() => void initButton(), 200);
        }
        return;
      }

      const mountEl = mountRef.current;
      if (!mountEl) return;

      await sdk.init({
        signInElement: mountEl,
        buttonConfig,
        oidcConfig,
        style,
      });
    };

    void initButton();
    return () => {
      cancelled = true;
    };
  }, [buttonConfig, oidcConfig, style]);

  return <div id={id} ref={mountRef} />;
}
