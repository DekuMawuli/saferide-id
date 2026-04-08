import { RoleGate } from '@/components/auth/role-gate';
import { SidebarLayout } from '@/components/shared/sidebar-layout';

export default function RiderLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={['passenger']}>
      <SidebarLayout role="rider">{children}</SidebarLayout>
    </RoleGate>
  );
}
