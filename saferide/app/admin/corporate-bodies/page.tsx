'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, Link2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Combobox } from '@/components/ui/combobox';
import { ApiError } from '@/lib/api/client';
import {
  attachOfficerToCorporate,
  createCorporateBody,
  fetchCorporateBodies,
  fetchOperatorsList,
} from '@/lib/api/governance';
import type { CorporateBodyRead, OperatorListItem } from '@/lib/api/types';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { toast } from 'sonner';

export default function AdminCorporateBodiesPage() {
  const { me, loading: sessionLoading } = useOperatorSession();
  const [rows, setRows] = useState<CorporateBodyRead[]>([]);
  const [operators, setOperators] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [corporatePick, setCorporatePick] = useState('');
  const [officerPick, setOfficerPick] = useState('');
  const [busy, setBusy] = useState(false);

  const isSystemAdmin = (me?.role || '').toLowerCase() === 'system_admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [corps, ops] = await Promise.all([fetchCorporateBodies(), fetchOperatorsList({ limit: 500 })]);
      setRows(corps);
      setOperators(ops);
      if (corps.length && !corporatePick) setCorporatePick(corps[0].id);
    } catch (e) {
      toast.error(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Failed to load corporate bodies');
      setRows([]);
      setOperators([]);
    } finally {
      setLoading(false);
    }
  }, [corporatePick]);

  useEffect(() => {
    void load();
  }, [load]);

  const officers = useMemo(
    () => operators.filter((r) => (r.operator.role || '').toLowerCase() === 'officer'),
    [operators],
  );

  const unassignedOfficers = useMemo(
    () => officers.filter((r) => !r.operator.corporate_body_id),
    [officers],
  );

  const onCreate = async () => {
    setBusy(true);
    try {
      await createCorporateBody({
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
      });
      toast.success('Corporate body created');
      setCreateOpen(false);
      setName('');
      setCode('');
      setDescription('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  };

  const onAttach = async () => {
    if (!corporatePick || !officerPick) return;
    setBusy(true);
    try {
      await attachOfficerToCorporate(corporatePick, officerPick);
      toast.success('Officer attached to corporate body');
      setAttachOpen(false);
      setOfficerPick('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Attach failed');
    } finally {
      setBusy(false);
    }
  };

  if (!sessionLoading && !isSystemAdmin) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Only <code className="text-xs">system_admin</code> can manage corporate bodies and officer attachments.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto">
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-indigo-950">
            <Building2 className="h-8 w-8 text-indigo-600" />
            Corporate Bodies
          </h1>
          <p className="mt-1 text-muted-foreground">Create corporate bodies and attach officer accounts.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />New Corporate Body</Button>} />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create corporate body</DialogTitle>
                <DialogDescription>System admin only.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Code (optional)</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Description (optional)</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={() => void onCreate()} disabled={busy || !name.trim()}>
                  {busy ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
            <DialogTrigger
              render={
                <Button variant="outline">
                  <Link2 className="mr-2 h-4 w-4" />
                  Attach Officer
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Attach officer to corporate body</DialogTitle>
                <DialogDescription>System admin only.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Combobox
                  label="Corporate body"
                  searchPlaceholder="Search corporate body..."
                  items={rows.map((c) => ({
                    id: c.id,
                    label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
                    searchText: `${c.name} ${c.code || ''} ${c.description || ''}`,
                  }))}
                  value={corporatePick}
                  onChange={setCorporatePick}
                />
                <Combobox
                  label="Officer"
                  searchPlaceholder="Search officer..."
                  items={unassignedOfficers.map((o) => ({
                    id: o.operator.id,
                    label: `${o.operator.full_name || o.operator.id.slice(0, 8)} · ${o.operator.email || 'no-email'}`,
                    searchText: `${o.operator.full_name || ''} ${o.operator.email || ''} ${o.operator.phone || ''}`,
                  }))}
                  value={officerPick}
                  onChange={setOfficerPick}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancel</Button>
                <Button onClick={() => void onAttach()} disabled={busy || !corporatePick || !officerPick}>
                  {busy ? 'Attaching…' : 'Attach'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Corporate body directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Officers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length ? (
                  rows.map((r) => {
                    const count = officers.filter((o) => o.operator.corporate_body_id === r.id).length;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell>{r.code || '—'}</TableCell>
                        <TableCell>{r.description || '—'}</TableCell>
                        <TableCell><Badge variant="secondary">{count}</Badge></TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No corporate bodies yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
