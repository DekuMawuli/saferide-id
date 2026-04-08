'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchOperatorsList, patchOperatorStatus } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function AdminRidersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({ q: q.trim() || undefined, limit: 300 });
      setRows(data.filter((r) => (r.operator.role || '').toLowerCase() === 'passenger'));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load riders');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="container mx-auto flex-1 px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-indigo-950">Riders</h1>
          <p className="text-muted-foreground">Passenger/rider identities only.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Rider creation is intentionally not available from system admin pages.
          </p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Rider directory</CardTitle>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search riders…" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No riders found.</TableCell></TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.operator.id}>
                      <TableCell>{r.operator.full_name || r.operator.id.slice(0, 8)}</TableCell>
                      <TableCell>{r.operator.email || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{r.operator.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            void (async () => {
                              try {
                                await patchOperatorStatus(r.operator.id, 'SUSPENDED');
                                toast.success('Rider suspended');
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
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
