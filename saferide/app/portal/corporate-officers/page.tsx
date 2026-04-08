'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Plus, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ApiError, postOfficerCreateUser } from '@/lib/api/client';
import { fetchOperatorsList, patchOperatorProfile, patchOperatorStatus } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'EXPIRED'] as const;

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

export default function PortalCorporateOfficersPage() {
  const { me } = useOperatorSession();
  const myId = me?.operator?.id ?? null;

  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [editOrigStatus, setEditOrigStatus] = useState<string>('ACTIVE');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({ limit: 500 });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Failed to load officers');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const officers = useMemo(
    () => rows.filter((r) => (r.operator.role || '').toLowerCase() === 'officer'),
    [rows],
  );

  const openEdit = (r: OperatorListItem) => {
    const op = r.operator;
    setEditId(op.id);
    setEditFullName(op.full_name ?? '');
    setEditEmail(op.email ?? '');
    const st = (op.status || 'ACTIVE').toUpperCase();
    setEditStatus(st);
    setEditOrigStatus(st);
    setEditOpen(true);
  };

  const onCreate = async () => {
    setCreating(true);
    try {
      await postOfficerCreateUser({
        email: email.trim(),
        password,
        full_name: fullName.trim() || null,
      });
      toast.success('Corporate officer created');
      setCreateOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const onSaveEdit = async () => {
    if (!editId) return;
    const em = editEmail.trim();
    const fn = editFullName.trim();
    if (!em) {
      toast.error('Email is required');
      return;
    }
    setSaving(true);
    try {
      await patchOperatorProfile(editId, {
        full_name: fn || null,
        email: em,
      });
      if (editStatus.toUpperCase() !== editOrigStatus.toUpperCase()) {
        await patchOperatorStatus(editId, editStatus.toUpperCase());
      }
      toast.success('Officer updated');
      setEditOpen(false);
      setEditId(null);
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (operatorId: string, next: string) => {
    try {
      await patchOperatorStatus(operatorId, next);
      toast.success(`Status → ${next}`);
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    }
  };

  return (
    <div className="container mx-auto">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4">
            <Link href="/portal" className="text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600">
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-slate-900">Corporate Officers</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-indigo-950">
            <Settings className="h-8 w-8 text-indigo-600" />
            Corporate Officers
          </h1>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Corporate Officer
          </Button>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Corporate Officer</DialogTitle>
              <DialogDescription>Officers can create fellow officers for corporate operations.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Full name</Label>
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={() => void onCreate()} disabled={creating || !email.trim() || !password}>
                {creating ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit officer</DialogTitle>
            <DialogDescription>Update name, email, and account status.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={(v) => setEditStatus(v ?? 'ACTIVE')}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={() => void onSaveEdit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Officer list</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Loading…</TableCell>
                  </TableRow>
                ) : officers.length ? (
                  officers.map((r) => {
                    const op = r.operator;
                    const isSelf = myId === op.id;
                    return (
                      <TableRow key={op.id}>
                        <TableCell className="font-medium text-indigo-950">{op.full_name || '—'}</TableCell>
                        <TableCell>{op.email || '—'}</TableCell>
                        <TableCell>{statusBadge(op.status)}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(op.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => openEdit(r)}>Edit details…</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => void setStatus(op.id, 'ACTIVE')}>
                                  Set ACTIVE
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void setStatus(op.id, 'APPROVED')}>
                                  Set APPROVED
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void setStatus(op.id, 'PENDING')}>
                                  Set PENDING
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => void setStatus(op.id, 'SUSPENDED')}
                                  disabled={isSelf}
                                >
                                  Suspend
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => void setStatus(op.id, 'EXPIRED')}>
                                  Mark EXPIRED
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No corporate officers yet.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
