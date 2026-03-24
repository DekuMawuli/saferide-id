'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, Filter, Download, Plus, Users } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchOperatorsList, patchOperatorStatus } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { toast } from 'sonner';

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'APPROVED') {
    return (
      <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        {s === 'ACTIVE' ? 'Active' : 'Approved'}
      </Badge>
    );
  }
  if (s === 'PENDING') {
    return <Badge className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>;
  }
  if (s === 'SUSPENDED') {
    return (
      <Badge variant="destructive" className="border-red-200 bg-red-100 text-red-800 hover:bg-red-100">
        Suspended
      </Badge>
    );
  }
  if (s === 'EXPIRED') {
    return (
      <Badge variant="secondary" className="border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100">
        Expired
      </Badge>
    );
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function PortalOperatorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({ q: searchTerm.trim() || undefined, limit: 200 });
      setRows(data);
    } catch (e) {
      const msg = e instanceof ApiError ? `${e.status}: ${e.message}` : 'Failed to load operators';
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchTerm]);

  const exportCsv = () => {
    const lines = [
      ['id', 'name', 'phone', 'status', 'short_code', 'vehicle_plate'].join(','),
      ...rows.map((r) =>
        [
          r.operator.id,
          `"${(r.operator.full_name ?? '').replace(/"/g, '""')}"`,
          r.operator.phone ?? '',
          r.operator.status,
          r.operator.verify_short_code ?? '',
          r.primary_vehicle_plate ?? '',
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'operators.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="container mx-auto">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4">
            <Link
              href="/portal"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600"
            >
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-slate-900">Operators</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-indigo-950">
            <Users className="h-8 w-8 text-indigo-600" />
            Operator Directory
          </h1>
          <p className="mt-1 text-muted-foreground">
            Live data from <code className="text-xs">GET /operators</code> (officer/admin token required).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/portal/operators/new">
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              <Plus className="mr-2 h-4 w-4" />
              Enroll Operator
            </Button>
          </Link>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <CardTitle className="text-lg font-semibold text-slate-800">All Operators</CardTitle>
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search name, phone, code, id…"
                  className="border-slate-200 bg-slate-50 pl-8 focus-visible:ring-indigo-600"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="shrink-0 border-slate-200 bg-slate-50" type="button">
                <Filter className="h-4 w-4 text-slate-600" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0 border-slate-200 bg-slate-50"
                title="Export"
                type="button"
                onClick={() => exportCsv()}
              >
                <Download className="h-4 w-4 text-slate-600" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Operator</TableHead>
                  <TableHead className="font-semibold text-slate-700">Code</TableHead>
                  <TableHead className="font-semibold text-slate-700">Vehicle</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700">Updated</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length > 0 ? (
                  rows.map((r) => {
                    const op = r.operator;
                    const name = op.full_name?.trim() || '—';
                    return (
                      <TableRow key={op.id} className="transition-colors hover:bg-slate-50/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200">
                              {op.photo_ref ? (
                                <img src={op.photo_ref} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <div>
                              <Link
                                href={`/portal/operators/${op.id}`}
                                className="font-medium text-indigo-950 hover:text-indigo-600 hover:underline"
                              >
                                {name}
                              </Link>
                              <div className="text-xs text-muted-foreground">{op.phone ?? '—'}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-indigo-600">
                          {op.verify_short_code ?? '—'}
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{r.primary_vehicle_plate ?? '—'}</span>
                        </TableCell>
                        <TableCell>{statusBadge(op.status)}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(op.updated_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <Link href={`/portal/operators/${op.id}`}>
                                <DropdownMenuItem>View / govern</DropdownMenuItem>
                              </Link>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  void (async () => {
                                    try {
                                      await patchOperatorStatus(op.id, 'ACTIVE');
                                      toast.success('Status set to ACTIVE');
                                      void load();
                                    } catch (e) {
                                      toast.error(e instanceof ApiError ? e.message : 'Update failed');
                                    }
                                  })()
                                }
                              >
                                Set ACTIVE
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() =>
                                  void (async () => {
                                    try {
                                      await patchOperatorStatus(op.id, 'SUSPENDED');
                                      toast.success('Suspended');
                                      void load();
                                    } catch (e) {
                                      toast.error(e instanceof ApiError ? e.message : 'Update failed');
                                    }
                                  })()
                                }
                              >
                                Suspend
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No operators found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <div>
              Showing {rows.length} operator{rows.length === 1 ? '' : 's'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
