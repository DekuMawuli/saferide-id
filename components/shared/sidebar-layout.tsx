'use client';

import Link from 'next/link';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu, ShieldCheck, Users, Car, AlertTriangle, Settings, LayoutDashboard, BadgeIcon as IdCard, User, LogOut, FileText } from 'lucide-react';

/** Dashboard roots must match exactly; otherwise `/portal/foo` would always highlight `/portal`. */
function isNavActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === '/portal' || href === '/admin') return false;
  return pathname.startsWith(`${href}/`);
}

const navLinks = {
  admin: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/corporate-bodies', label: 'Corporate Bodies', icon: Settings },
    { href: '/admin/platform-admins', label: 'Platform Admins', icon: Settings },
    { href: '/admin/operators', label: 'Operators', icon: Users },
    { href: '/admin/riders', label: 'Riders', icon: User },
    { href: '/admin/vehicles', label: 'Vehicles', icon: Car },
    { href: '/admin/incidents', label: 'Incidents', icon: AlertTriangle },
    { href: '/admin/audit', label: 'Audit Log', icon: FileText },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ],
  portal: [
    { href: '/portal', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/portal/operators', label: 'Riders', icon: Users },
    { href: '/portal/corporate-officers', label: 'Corporate Officers', icon: Settings },
    { href: '/portal/vehicles', label: 'Vehicles', icon: Car },
    { href: '/portal/badges', label: 'Badges', icon: IdCard },
    { href: '/portal/incidents', label: 'Incidents', icon: AlertTriangle },
  ],
  driver: [
    { href: '/driver/profile', label: 'My Profile', icon: User },
    { href: '/driver/vehicle', label: 'My Vehicle', icon: Car },
    { href: '/driver/status', label: 'Status & Compliance', icon: ShieldCheck },
  ],
  rider: [
    { href: '/rider/status', label: 'My Status', icon: ShieldCheck },
  ],
};

export function SidebarLayout({ children, role, badgeCounts = {} }: { children: React.ReactNode, role: 'admin' | 'portal' | 'driver' | 'rider', badgeCounts?: Record<string, number> }) {
  const pathname = usePathname();
  const { signOut } = useOperatorSession();
  const links = navLinks[role];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white fixed inset-y-0 z-10">
        <div className="p-6 flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <span className="text-xl font-bold text-indigo-950 tracking-tight">SafeRide</span>
        </div>
        <div className="px-4 py-2 flex-1">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3">
            {role === 'admin' ? 'Administration' : role === 'portal' ? 'Officer Portal' : role === 'driver' ? 'Driver Portal' : 'Rider Portal'}
          </div>
          <div className="space-y-1">
            {links.map((link) => {
              const isActive = isNavActive(pathname, link.href);
              const Icon = link.icon;
              const count = badgeCounts[link.href] ?? 0;
              return (
                <Link key={link.href} href={link.href}>
                  <span className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}>
                    <Icon className={cn("h-4 w-4", isActive ? "text-indigo-700" : "text-slate-500")} />
                    <span className="flex-1">{link.label}</span>
                    {count > 0 && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                        {count}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
        <div className="p-4 border-t border-slate-200">
          <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-slate-900 hover:bg-slate-100" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Mobile Header & Content */}
      <div className="flex-1 flex flex-col md:pl-64 min-h-screen">
        <header className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
            <span className="text-lg font-bold text-indigo-950">SafeRide</span>
          </div>
          <Sheet>
            <SheetTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover:bg-accent hover:text-accent-foreground h-9 w-9 text-slate-600">
              <Menu className="h-6 w-6" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <div className="p-6 flex items-center gap-2 border-b border-slate-100">
                <ShieldCheck className="h-6 w-6 text-indigo-600" />
                <span className="text-xl font-bold text-indigo-950">SafeRide</span>
              </div>
              <div className="p-4 flex-1">
                <div className="space-y-1">
                  {links.map((link) => {
                    const isActive = isNavActive(pathname, link.href);
                    const Icon = link.icon;
                    const count = badgeCounts[link.href] ?? 0;
                    return (
                      <Link key={link.href} href={link.href}>
                        <span className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                          isActive ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        )}>
                          <Icon className={cn("h-4 w-4", isActive ? "text-indigo-700" : "text-slate-500")} />
                          <span className="flex-1">{link.label}</span>
                          {count > 0 && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
                              {count}
                            </span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t border-slate-200">
                <Link href="/login">
                  <Button variant="ghost" className="w-full justify-start text-slate-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </header>
        
        <main className="flex-1 p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
