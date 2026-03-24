'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Search } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchOperatorsList, patchOperatorStatus } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { toast } from 'sonner';

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE' || s === 'APPROVED') {
    return (
      <Badge className="bg-emerald-500 hover:bg-emerald-600">
        {s === 'ACTIVE' ? 'Active' : 'Approved'}
      </Badge>
    );
  }
  if (s === 'PENDING') return <Badge variant="secondary">Pending</Badge>;
  if (s === 'SUSPENDED') return <Badge variant="destructive">Suspended</Badge>;
  if (s === 'EXPIRED') return <Badge variant="outline">Expired</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function AdminOperatorsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({ q: searchTerm.trim() || undefined, limit: 200 });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load operators');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchTerm]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="container mx-auto flex-1 px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            href="/admin"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h1 className="text-3xl font-bold text-indigo-950">Operator directory</h1>
            <p className="text-muted-foreground">
              Same API as the officer portal. Open an operator to govern bindings and QR.
            </p>
          </div>
          <Button
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            type="button"
            onClick={() => {
              const lines = [
                ['id', 'name', 'status', 'code', 'plate'].join(','),
                ...rows.map((r) =>
                  [
                    r.operator.id,
                    `"${(r.operator.full_name ?? '').replace(/"/g, '""')}"`,
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
            }}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search…"
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No operators.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const op = r.operator;
                      return (
                        <TableRow key={op.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <Link
                              href={`/portal/operators/${op.id}`}
                              className="font-medium text-indigo-950 hover:underline"
                            >
                              {op.full_name?.trim() || op.id.slice(0, 8)}
                            </Link>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{op.verify_short_code ?? '—'}</TableCell>
                          <TableCell>{r.primary_vehicle_plate ?? '—'}</TableCell>
                          <TableCell>{statusBadge(op.status)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="mr-2"
                              onClick={() =>
                                void (async () => {
                                  try {
                                    await patchOperatorStatus(op.id, 'ACTIVE');
                                    toast.success('ACTIVE');
                                    void load();
                                  } catch (e) {
                                    toast.error(e instanceof ApiError ? e.message : 'Failed');
                                  }
                                })()
                              }
                            >
                              Activate
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                void (async () => {
                                  try {
                                    await patchOperatorStatus(op.id, 'SUSPENDED');
                                    toast.success('Suspended');
                                    void load();
                                  } catch (e) {
                                    toast.error(e instanceof ApiError ? e.message : 'Failed');
                                  }
                                })()
                              }
                            >
                              Suspend
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
