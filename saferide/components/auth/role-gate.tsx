'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { Button } from '@/components/ui/button';

type RoleGateProps = {
  allowedRoles: readonly string[];
  children: React.ReactNode;
};

function roleOk(role: string | null | undefined, allowed: readonly string[]): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return allowed.map((x) => x.toLowerCase()).includes(r);
}

export function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, loading, hasToken, apiConfigured, error, refresh, signOut } = useOperatorSession();
  const isAdminArea = pathname.startsWith('/admin');
  const isPortalArea = pathname.startsWith('/portal');
  const loginPath = isAdminArea || isPortalArea
    ? '/login/corporate'
    : '/login/driver';

  useEffect(() => {
    if (!apiConfigured || loading || error) return;
    if (!hasToken || !me?.authenticated) {
      router.replace(loginPath);
      return;
    }
    if (!roleOk(me.role, allowedRoles)) {
      router.replace(loginPath);
    }
  }, [allowedRoles, apiConfigured, error, hasToken, loading, loginPath, me, pathname, router]);

  if (!apiConfigured) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <p>Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> to use this area.</p>
      </div>
    );
  }

  if (error && hasToken) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="space-y-2">
          <p className="font-medium text-foreground">Unable to verify your session.</p>
          <p className="max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button onClick={() => void refresh()}>Retry</Button>
          <Button variant="outline" onClick={() => signOut(loginPath)}>Sign in again</Button>
        </div>
      </div>
    );
  }

  // Show loading only when we don't have a session yet (initial load).
  // If me is already authenticated, render children optimistically while re-validating
  // in the background (e.g. after bfcache restoration from eSignet back-navigation).
  if (!me?.authenticated || !roleOk(me.role, allowedRoles)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
