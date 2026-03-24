import { RoleGate } from '@/components/auth/role-gate';
import { SidebarLayout } from '@/components/shared/sidebar-layout';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGate allowedRoles={['admin']}>
      <SidebarLayout role="admin">{children}</SidebarLayout>
    </RoleGate>
  );
}
