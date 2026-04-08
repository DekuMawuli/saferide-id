'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, ShieldAlert, Activity, ArrowRight, FileText, Settings } from 'lucide-react';
import { fetchOperatorsList, fetchVehicles } from '@/lib/api/governance';
import { fetchSimSmsOutbox, type SimSmsRow } from '@/lib/api/public-trust';
import { ApiError } from '@/lib/api/client';
import type { OperatorListItem, VehicleListItem } from '@/lib/api/types';
import { toast } from 'sonner';

const STAFF_ROLES = new Set(['admin', 'system_admin', 'monitor', 'support']);

export default function AdminDashboard() {
  const [operators, setOperators] = useState<OperatorListItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleListItem[]>([]);
  const [smsRows, setSmsRows] = useState<SimSmsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ops, vs, sms] = await Promise.all([
          fetchOperatorsList({ limit: 300 }),
          fetchVehicles(),
          fetchSimSmsOutbox(200),
        ]);
        setOperators(ops);
        setVehicles(vs);
        setSmsRows(sms);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to load admin data');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const businessRows = useMemo(
    () => operators.filter((r) => !STAFF_ROLES.has((r.operator.role || '').toLowerCase())),
    [operators],
  );
  const totalOperators = businessRows.length;
  const activeOperators = businessRows.filter((r) => ['ACTIVE', 'APPROVED'].includes(r.operator.status.toUpperCase())).length;
  const suspendedOperators = businessRows.filter((r) => r.operator.status.toUpperCase() === 'SUSPENDED').length;
  const totalIncidents = smsRows.filter((r) => r.tag === 'report' || r.tag === 'panic').length;
  const passengerCount = businessRows.filter((r) => (r.operator.role || '').toLowerCase() === 'passenger').length;
  const driverCount = businessRows.filter((r) => (r.operator.role || '').toLowerCase() === 'driver').length;
  const corporateCount = businessRows.filter((r) => (r.operator.role || '').toLowerCase() === 'officer').length;
  const recentOperators = useMemo(() => businessRows.slice(0, 4), [businessRows]);
  const recentIncidents = useMemo(
    () => smsRows.filter((r) => r.tag === 'report' || r.tag === 'panic').slice(0, 4),
    [smsRows],
  );

  return (
    <div className="flex flex-col">
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-950">System Administration</h1>
            <p className="text-muted-foreground">Platform-level monitoring and control.</p>
            
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Passengers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-950">{passengerCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Drivers / Operators</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-950">{driverCount}</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Corporate Officers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-950">{corporateCount}</div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Link href="/admin/platform-admins">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Platform Admins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-950">
                  {operators.filter((r) => STAFF_ROLES.has((r.operator.role || '').toLowerCase())).length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Admin, system admin, support, monitor</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/operators">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Operators</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-950">{driverCount + corporateCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Drivers and corporate officers</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/admin/riders">
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Riders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-indigo-950">{passengerCount}</div>
                <p className="text-xs text-muted-foreground mt-1">Passenger/rider identities</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Operators</CardTitle>
              <Users className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{totalOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all associations
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Profiles</CardTitle>
              <Activity className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{activeOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently verified
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
                Pending review
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Incidents</CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{totalIncidents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Reported by passengers
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Operator Directory</CardTitle>
                <CardDescription>Manage all registered operators.</CardDescription>
              </div>
              <Link href="/admin/operators">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
                {!loading && recentOperators.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No operators yet.</p>
                ) : null}
                {recentOperators.map(({ operator: op, primary_vehicle_plate }) => (
                  <div key={op.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        ['ACTIVE', 'APPROVED'].includes(op.status.toUpperCase()) ? 'bg-emerald-500' :
                        op.status.toUpperCase() === 'SUSPENDED' ? 'bg-red-500' :
                        'bg-amber-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-indigo-950">{op.full_name?.trim() || op.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">{op.verify_short_code ?? '—'} • {primary_vehicle_plate ?? 'No vehicle'}</p>
                      </div>
                    </div>
                    <Link href={`/portal/operators/${op.id}`}>
                      <Button variant="ghost" size="sm" className="h-8 text-xs">Manage</Button>
                    </Link>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Incident Reports</CardTitle>
                <CardDescription>Recent issues flagged by passengers.</CardDescription>
              </div>
              <Link href="/admin/incidents">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
                {!loading && recentIncidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No incidents in current stream.</p>
                ) : null}
                {recentIncidents.map((inc) => (
                  <div key={inc.id} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-indigo-950">{inc.tag === 'report' ? 'Public report' : 'Panic alert'}</p>
                        <p className="text-xs text-muted-foreground">Destination: {inc.to}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        inc.tag === 'panic' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {inc.tag}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-2">{inc.body}</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                      <span className="text-xs text-muted-foreground">{new Date(inc.created_at).toLocaleString()}</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
