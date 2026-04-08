'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Filter, Download, Activity } from 'lucide-react';
import { fetchOperatorsList, fetchVehicles } from '@/lib/api/governance';
import { fetchSimSmsOutbox, fetchRideEvents } from '@/lib/api/public-trust';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

type AuditLog = {
  id: string;
  date: string;
  action: string;
  actor: string;
  target: string;
  details: string;
};

export default function AdminAuditLogPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [ops, vs, sms, rides] = await Promise.all([
          fetchOperatorsList({ limit: 300 }),
          fetchVehicles(),
          fetchSimSmsOutbox(200),
          fetchRideEvents(200),
        ]);
        const built: AuditLog[] = [
          ...ops.slice(0, 80).map((r) => ({
            id: `OP-${r.operator.id}`,
            date: r.operator.updated_at,
            action: 'operator_synced',
            actor: 'system',
            target: r.operator.verify_short_code ?? r.operator.id.slice(0, 8),
            details: `${r.operator.full_name || 'Operator'} status=${r.operator.status}`,
          })),
          ...vs.slice(0, 80).map((item) => {
            const v = item.vehicle;
            return {
              id: `VH-${v.id}`,
              date: v.updated_at,
              action: 'vehicle_synced',
              actor: 'system',
              target: v.external_ref || v.id.slice(0, 8),
              details: v.display_name || v.make_model || 'Vehicle record updated',
            };
          }),
          ...sms.slice(0, 80).map((m) => ({
            id: `SMS-${m.id}`,
            date: m.created_at,
            action: `sms_${m.tag}`,
            actor: 'simulator',
            target: m.to,
            details: m.body.slice(0, 140),
          })),
          ...rides.map((e) => ({
            id: `RIDE-${e.id}`,
            date: e.recorded_at,
            action: e.event_type,
            actor: e.channel.toLowerCase(),
            target: e.verify_short_code,
            details: e.passenger_msisdn ? `msisdn=${e.passenger_msisdn}` : 'anonymous scan',
          })),
        ].sort((a, b) => +new Date(b.date) - +new Date(a.date));
        setLogs(built);
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to load audit feed');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) =>
        `${log.action} ${log.actor} ${log.target} ${log.details}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase()),
      ),
    [logs, searchTerm],
  );

  const renderActionBadge = (action: string) => {
    if (action.includes('enrolled') || action.includes('resolved') || action.includes('bound')) {
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">{action.replace('_', ' ')}</Badge>;
    }
    if (action.includes('failed') || action.includes('suspended')) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">{action.replace('_', ' ')}</Badge>;
    }
    return <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200">{action.replace('_', ' ')}</Badge>;
  };

  return (
    <div className="container mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-indigo-600 flex items-center transition-colors">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-950 flex items-center gap-2">
              <Activity className="h-8 w-8 text-indigo-600" />
              System Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">Track all administrative actions and system events.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white">
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Recent Activity</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search action, actor, or target..."
                    className="pl-8 bg-slate-50 border-slate-200 focus-visible:ring-indigo-600"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="icon" className="bg-slate-50 border-slate-200 shrink-0">
                  <Filter className="h-4 w-4 text-slate-600" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Timestamp</TableHead>
                    <TableHead className="font-semibold text-slate-700">Action</TableHead>
                    <TableHead className="font-semibold text-slate-700">Actor</TableHead>
                    <TableHead className="font-semibold text-slate-700">Target</TableHead>
                    <TableHead className="font-semibold text-slate-700">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                          {new Date(log.date).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">{renderActionBadge(log.action)}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-700">{log.actor}</TableCell>
                        <TableCell className="font-mono text-sm text-indigo-600">{log.target}</TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No logs found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Showing {filteredLogs.length} of {logs.length} logs</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm" disabled>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
