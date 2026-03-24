'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useOperatorSession } from '@/hooks/use-operator-session';

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
  const { me, loading, hasToken, apiConfigured } = useOperatorSession();

  useEffect(() => {
    if (!apiConfigured || loading) return;
    if (!hasToken || !me?.authenticated) {
      const next =
        pathname.startsWith('/portal') ? '/portal' : pathname.startsWith('/admin') ? '/admin' : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    if (!roleOk(me.role, allowedRoles)) {
      router.replace('/login');
    }
  }, [allowedRoles, apiConfigured, hasToken, loading, me, pathname, router]);

  if (!apiConfigured) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
        <p>Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> to use this area.</p>
      </div>
    );
  }

  if (loading || !me?.authenticated || !roleOk(me.role, allowedRoles)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
