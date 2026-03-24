import { SidebarLayout } from '@/components/shared/sidebar-layout';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  return <SidebarLayout role="driver">{children}</SidebarLayout>;
}
