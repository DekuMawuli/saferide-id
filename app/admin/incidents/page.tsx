'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Filter, Download, AlertOctagon } from 'lucide-react';
import { fetchSimSmsOutbox, type SimSmsRow } from '@/lib/api/public-trust';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

export default function AdminIncidentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<SimSmsRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const sms = await fetchSimSmsOutbox(300);
        setRows(sms.filter((r) => r.tag === 'report' || r.tag === 'panic'));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to load incidents');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredIncidents = useMemo(
    () =>
      rows.filter((r) =>
        `${r.tag} ${r.to} ${r.body}`.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [rows, searchTerm],
  );

  const renderStatusBadge = (tag: string) =>
    tag === 'panic' ? (
      <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Open</Badge>
    ) : (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Reported</Badge>
    );

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive" className="bg-red-600 text-white hover:bg-red-700">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
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
              <AlertOctagon className="h-8 w-8 text-indigo-600" />
              Incident Reports
            </h1>
            <p className="text-muted-foreground mt-1">Review and manage reported issues across the platform.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-slate-800">All Incidents</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search ID, type, or status..."
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
                    <TableHead className="font-semibold text-slate-700">ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Date</TableHead>
                    <TableHead className="font-semibold text-slate-700">Target</TableHead>
                    <TableHead className="font-semibold text-slate-700">Type</TableHead>
                    <TableHead className="font-semibold text-slate-700">Severity</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filteredIncidents.length > 0 ? (
                    filteredIncidents.map((incident) => (
                      <TableRow key={incident.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono font-medium text-indigo-950">{incident.id}</TableCell>
                        <TableCell className="text-sm text-slate-600">{new Date(incident.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono text-xs">{incident.to}</TableCell>
                        <TableCell className="capitalize text-slate-600">{incident.tag}</TableCell>
                        <TableCell>{renderSeverityBadge(incident.tag === 'panic' ? 'high' : 'medium')}</TableCell>
                        <TableCell>{renderStatusBadge(incident.tag)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No incident stream rows yet (panic/report SMS simulator).
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Showing {filteredIncidents.length} of {rows.length} incidents</div>
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
