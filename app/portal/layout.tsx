import { RoleGate } from '@/components/auth/role-gate';
import { SidebarLayout } from '@/components/shared/sidebar-layout';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={['officer', 'admin', 'system_admin', 'support']}>
      <SidebarLayout role="portal">{children}</SidebarLayout>
    </RoleGate>
  );
}
