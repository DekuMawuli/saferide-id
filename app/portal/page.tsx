'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, ShieldAlert, PlusCircle, Search, ArrowRight, FileText } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchOperatorsList } from '@/lib/api/governance';
import { fetchPublicReports, type PublicIncidentRow } from '@/lib/api/public-trust';
import type { OperatorListItem } from '@/lib/api/types';
import { toast } from 'sonner';

/** Same scope as /portal/operators: passenger + driver rows; excludes officers/admins (API is corporate-scoped). */
function isDirectoryRider(item: OperatorListItem): boolean {
  const r = (item.operator.role || '').trim().toLowerCase();
  return r === 'passenger' || r === 'driver';
}

export default function PortalDashboard() {
  const [operators, setOperators] = useState<OperatorListItem[]>([]);
  const [reports, setReports] = useState<PublicIncidentRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [ops, incs] = await Promise.all([
          fetchOperatorsList({ limit: 200 }),
          fetchPublicReports(50),
        ]);
        setOperators(ops);
        setReports(incs);
      } catch (e) {
        toast.error(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Failed to load portal dashboard');
      }
    })();
  }, []);

  const riders = useMemo(() => operators.filter(isDirectoryRider), [operators]);

  const activeOperators = useMemo(
    () => riders.filter((o) => ['ACTIVE', 'APPROVED'].includes(o.operator.status.toUpperCase())).length,
    [riders],
  );
  const suspendedOperators = useMemo(
    () => riders.filter((o) => o.operator.status.toUpperCase() === 'SUSPENDED').length,
    [riders],
  );
  const openIncidents = reports.length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-950">Officer Portal</h1>
            <p className="text-muted-foreground">Manage your association&apos;s riders, drivers, and vehicles.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/portal/operators">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Enroll Rider
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Riders</CardTitle>
              <Users className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{activeOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Passenger and driver accounts (your corporate body)
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{suspendedOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires review
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Incidents</CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{openIncidents}</div>
              <p className="text-xs text-muted-foreground mt-1">From public trust feed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Enrollments</CardTitle>
                  <CardDescription>Latest riders added to your association.</CardDescription>
                </div>
                <Link href="/portal/operators">
                  <Button variant="ghost" size="sm" className="text-indigo-600">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {riders.slice(0, 3).map((r) => {
                    const op = r.operator;
                    const status = op.status.toLowerCase();
                    return (
                    <div key={op.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-100 hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full object-cover bg-slate-100 overflow-hidden">
                          {op.photo_ref ? <img src={op.photo_ref} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <div>
                          <p className="font-semibold text-indigo-950">{op.full_name || '—'}</p>
                          <p className="text-sm text-muted-foreground">{op.verify_short_code || '—'} • {r.primary_vehicle_plate || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          status === 'active' || status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                          status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        <Link href={`/portal/operators/${op.id}`}>
                          <Button variant="ghost" size="sm">Details</Button>
                        </Link>
                      </div>
                    </div>
                  )})}
                  {!riders.length ? <p className="text-sm text-muted-foreground">No live rider accounts yet.</p> : null}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm bg-indigo-950 text-white">
              <CardHeader>
                <CardTitle className="text-indigo-50">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/portal/operators" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <PlusCircle className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Enroll Rider</p>
                    <p className="text-xs text-indigo-300">Add a new rider account</p>
                  </div>
                </Link>
                <Link href="/portal/vehicles" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <Car className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Bind Vehicle</p>
                    <p className="text-xs text-indigo-300">Assign to rider/driver</p>
                  </div>
                </Link>
                <Link href="/portal/operators" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <Search className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Search Directory</p>
                    <p className="text-xs text-indigo-300">Find by code or name</p>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports.slice(0, 2).map((inc) => (
                    <div key={inc.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm text-indigo-950">{inc.incident_type}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Op: {inc.operator_code || '—'} • {new Date(inc.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                  {!reports.length ? <p className="text-sm text-muted-foreground">No live incidents yet.</p> : null}
                </div>
                <Link href="/portal/incidents">
                  <Button variant="outline" className="w-full mt-4 text-sm">View All Incidents</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
