import { RoleGate } from '@/components/auth/role-gate';
import { SidebarLayout } from '@/components/shared/sidebar-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={['admin', 'system_admin', 'monitor']}>
      <SidebarLayout role="admin">{children}</SidebarLayout>
    </RoleGate>
  );
}
