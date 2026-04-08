'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Download, Plus, Search, ShieldCheck } from 'lucide-react';
import { ApiError, postAdminCreateUser } from '@/lib/api/client';
import { attachOfficerToCorporate, fetchCorporateBodies, fetchOperatorsList, patchOperatorStatus } from '@/lib/api/governance';
import type { CorporateBodyRead, OperatorListItem } from '@/lib/api/types';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import { getApiBaseUrl, isApiConfigured } from '@/lib/api/config';

const STAFF_ROLES = new Set(['admin', 'system_admin', 'monitor', 'support']);
const OPERATOR_ROLES = new Set(['officer']);

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

function roleBadge(role: string) {
  const r = (role || '').toLowerCase();
  if (r === 'driver') return <Badge className="bg-blue-600 hover:bg-blue-700">Driver</Badge>;
  if (r === 'passenger') return <Badge className="bg-sky-600 hover:bg-sky-700">Passenger</Badge>;
  if (r === 'officer') return <Badge className="bg-amber-600 hover:bg-amber-700">Officer</Badge>;
  if (r === 'support') return <Badge variant="secondary">Support</Badge>;
  if (r === 'monitor') return <Badge variant="secondary">Monitor</Badge>;
  if (r === 'system_admin') return <Badge variant="destructive">System Admin</Badge>;
  if (r === 'admin') return <Badge variant="destructive">Admin</Badge>;
  return <Badge variant="outline">{role || 'unknown'}</Badge>;
}

export default function AdminOperatorsPage() {
  const apiBase = isApiConfigured() ? getApiBaseUrl() : '';
  const esignetMountRef = useRef<HTMLDivElement | null>(null);
  const [esignetReady, setEsignetReady] = useState(false);
  const esignetAuthorizeUri = process.env.NEXT_PUBLIC_ESIGNET_AUTHORIZE_URI || 'http://localhost:3000/authorize';
  const esignetClientId = process.env.NEXT_PUBLIC_ESIGNET_CLIENT_ID || 'saferide-web';
  const esignetScope = process.env.NEXT_PUBLIC_ESIGNET_SCOPE || 'openid profile';
  const esignetRedirectUri =
    process.env.NEXT_PUBLIC_ESIGNET_REDIRECT_URI || "";
  const onboardingStartUrl = useMemo(() => esignetAuthorizeUri, [esignetAuthorizeUri]);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [open, setOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [corporates, setCorporates] = useState<CorporateBodyRead[]>([]);
  const [corporateId, setCorporateId] = useState('');
  const [attachCorporateId, setAttachCorporateId] = useState('');
  const [attachOfficerId, setAttachOfficerId] = useState('');
  const [editOfficerId, setEditOfficerId] = useState('');
  const [editCorporateId, setEditCorporateId] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({
        q: searchTerm.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        limit: 300,
      });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load operators');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => void load(), searchTerm ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, searchTerm, statusFilter]);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchCorporateBodies();
        setCorporates(data);
      } catch {
        setCorporates([]);
      }
    })();
  }, []);

  const filteredRows = rows.filter((r) => {
    const role = (r.operator.role || '').toLowerCase();
    return OPERATOR_ROLES.has(role) && !STAFF_ROLES.has(role);
  });

  const createOperator = async () => {
    setCreating(true);
    try {
      const created = await postAdminCreateUser({
        email: email.trim(),
        password,
        full_name: fullName.trim() || null,
        role: 'officer',
      });
      if (corporateId) {
        await attachOfficerToCorporate(corporateId, created.id);
      }
      toast.success('Officer account created');
      setOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setCorporateId('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create operator');
    } finally {
      setCreating(false);
    }
  };

  const attachCorporate = async () => {
    if (!attachCorporateId || !attachOfficerId) return;
    try {
      await attachOfficerToCorporate(attachCorporateId, attachOfficerId);
      toast.success('Corporate body attached');
      setAttachOpen(false);
      setAttachCorporateId('');
      setAttachOfficerId('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to attach corporate body');
    }
  };

  const openEditOfficer = (officerId: string, currentCorporateId?: string | null) => {
    setEditOfficerId(officerId);
    setEditCorporateId(currentCorporateId || '');
    setEditOpen(true);
  };

  const saveEditCorporate = async () => {
    if (!editOfficerId || !editCorporateId) return;
    try {
      await attachOfficerToCorporate(editCorporateId, editOfficerId);
      toast.success('Corporate body updated');
      setEditOpen(false);
      setEditOfficerId('');
      setEditCorporateId('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to update corporate body');
    }
  };

  const officerRows = filteredRows.filter((r) => (r.operator.role || '').toLowerCase() === 'officer');

  useEffect(() => {
    if (!onboardingStartUrl || !esignetMountRef.current || typeof window === 'undefined') return;
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 30;
    const renderButton = async () => {
      const promptValue = (process.env.NEXT_PUBLIC_ESIGNET_PROMPT || 'consent') as
        | 'none'
        | 'login'
        | 'consent'
        | 'select_account';
      const sdk = (
        window as Window & {
          SignInWithEsignetButton?: {
            init: (args: {
              signInElement: HTMLElement;
              oidcConfig: {
                authorizeUri: string;
                redirect_uri: string;
                client_id: string;
                scope: string;
                response_type?: 'code';
                acr_values?: string;
                claims_locales?: string;
                display?: 'page' | 'popup' | 'touch' | 'wap';
                max_age?: number;
                nonce?: string;
                prompt?: 'none' | 'login' | 'consent' | 'select_account';
                state?: string;
                ui_locales?: string;
              };
              buttonConfig?: {
                type?: 'standard' | 'icon';
                theme?: 'outline' | 'filled_orange' | 'filled_black' | 'custom';
                shape?: 'sharp_edges' | 'soft_edges' | 'rounded_edges';
                labelText?: string;
              };
              style?: Record<string, string>;
            }) => Promise<unknown>;
          };
        }
      ).SignInWithEsignetButton;
      if (!sdk?.init) {
        attempts += 1;
        if (!cancelled && attempts < maxAttempts) window.setTimeout(() => void renderButton(), 200);
        return;
      }
      const mountEl = esignetMountRef.current;
      if (!mountEl) return;
      await sdk.init({
        signInElement: mountEl,
        oidcConfig: {
          acr_values:
            process.env.NEXT_PUBLIC_ESIGNET_ACR_VALUES || '',
          authorizeUri: onboardingStartUrl,
          claims_locales: process.env.NEXT_PUBLIC_ESIGNET_CLAIMS_LOCALES || 'en',
          client_id: esignetClientId,
          display: 'page',
          max_age: Number(process.env.NEXT_PUBLIC_ESIGNET_MAX_AGE || '21'),
          nonce: crypto.randomUUID(),
          prompt: promptValue,
          redirect_uri: esignetRedirectUri,
          scope: esignetScope,
          state: crypto.randomUUID(),
          ui_locales: process.env.NEXT_PUBLIC_ESIGNET_UI_LOCALES || 'en',
          response_type: 'code',
        },
        buttonConfig: {
          type: 'standard',
          theme: 'filled_black',
          shape: 'soft_edges',
          labelText: 'Onboard with eSignet',
        },
        style: { width: '220px' },
      });
      if (!cancelled) setEsignetReady(true);
    };
    void renderButton();
    return () => {
      cancelled = true;
    };
  }, [onboardingStartUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Script
        src="http://localhost:3000/plugins/sign-in-button-plugin.js"
        strategy="afterInteractive"
      />
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
              Dedicated officer management view. Platform admins and riders are on separate pages.
            </p>
          </div>
          <div className="flex gap-2">
            {apiBase ? (
              <div className="relative">
                {/* eSignet SDK mounts here — hidden until ready */}
                <div
                  ref={esignetMountRef}
                  className={esignetReady ? 'opacity-100' : 'pointer-events-none absolute opacity-0'}
                />
                {/* Styled fallback shown while SDK loads or as primary CTA */}
                {!esignetReady ? (
                  <a href={onboardingStartUrl}>
                    <button
                      type="button"
                      className="group flex items-center gap-2.5 rounded-xl border border-indigo-300 bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:from-indigo-500 hover:to-indigo-600 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98]"
                    >
                      <ShieldCheck className="h-4 w-4 text-indigo-200 transition-colors group-hover:text-white" />
                      <span>Onboard with eSignet</span>
                      <span className="rounded-full bg-indigo-500/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-indigo-100">
                        ID
                      </span>
                    </button>
                  </a>
                ) : null}
              </div>
            ) : null}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />New Operator</Button>} />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create operator</DialogTitle>
                  <DialogDescription>Create an operator account (role is fixed to officer).</DialogDescription>
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
                  <div className="space-y-1">
                    <Label>Corporate body</Label>
                    <Combobox
                      searchPlaceholder="Search corporate body..."
                      emptyText="No corporate body found"
                      items={corporates.map((c) => ({
                        id: c.id,
                        label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
                        searchText: `${c.name} ${c.code || ''} ${c.description || ''}`,
                      }))}
                      value={corporateId}
                      onChange={setCorporateId}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void createOperator()} disabled={creating || !email.trim() || !password}>
                    {creating ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={attachOpen} onOpenChange={setAttachOpen}>
              <DialogTrigger
                render={
                  <Button variant="outline" type="button">
                    Attach Corporate Body
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Attach officer to corporate body</DialogTitle>
                  <DialogDescription>Edit corporate body membership for an officer.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Combobox
                      label="Officer"
                      searchPlaceholder="Search officer..."
                      emptyText="No officer found"
                      items={officerRows.map((r) => ({
                        id: r.operator.id,
                        label: `${r.operator.full_name || 'Unnamed Officer'}${r.operator.email ? ` • ${r.operator.email}` : ''}`,
                        searchText: `${r.operator.full_name || ''} ${r.operator.email || ''} ${r.operator.phone || ''}`,
                      }))}
                      value={attachOfficerId}
                      onChange={setAttachOfficerId}
                    />
                  </div>
                  <div className="space-y-1">
                    <Combobox
                      label="Corporate body"
                      searchPlaceholder="Search corporate body..."
                      emptyText="No corporate body found"
                      items={corporates.map((c) => ({
                        id: c.id,
                        label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
                        searchText: `${c.name} ${c.code || ''} ${c.description || ''}`,
                      }))}
                      value={attachCorporateId}
                      onChange={setAttachCorporateId}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAttachOpen(false)}>Cancel</Button>
                  <Button onClick={() => void attachCorporate()} disabled={!attachCorporateId || !attachOfficerId}>
                    Attach
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit officer</DialogTitle>
                  <DialogDescription>Update officer corporate body assignment.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>Officer</Label>
                    <Input
                      disabled
                      value={
                        officerRows.find((r) => r.operator.id === editOfficerId)?.operator.full_name ||
                        officerRows.find((r) => r.operator.id === editOfficerId)?.operator.email ||
                        editOfficerId
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Combobox
                      label="Corporate body"
                      searchPlaceholder="Search corporate body..."
                      emptyText="No corporate body found"
                      items={corporates.map((c) => ({
                        id: c.id,
                        label: `${c.name}${c.code ? ` (${c.code})` : ''}`,
                        searchText: `${c.name} ${c.code || ''} ${c.description || ''}`,
                      }))}
                      value={editCorporateId}
                      onChange={setEditCorporateId}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button onClick={() => void saveEditCorporate()} disabled={!editOfficerId || !editCorporateId}>
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
        </div>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search…"
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || 'all')}>
                <SelectTrigger>
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="APPROVED">APPROVED</SelectItem>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="SUSPENDED">SUSPENDED</SelectItem>
                  <SelectItem value="EXPIRED">EXPIRED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Showing <span className="font-semibold">{filteredRows.length}</span> filtered rows out of{' '}
              <span className="font-semibold">{rows.length}</span> loaded rows.
            </p>
            <div className="overflow-hidden rounded-md border border-slate-200">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead>Operator</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Vehicle</TableHead>
                  <TableHead>Corporate Body</TableHead>
                  <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        Loading…
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No operators match current filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((r) => {
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
                          <TableCell>{roleBadge(op.role)}</TableCell>
                          <TableCell className="font-mono text-xs">{op.verify_short_code ?? '—'}</TableCell>
                          <TableCell>{r.primary_vehicle_plate ?? '—'}</TableCell>
                          <TableCell>
                            {corporates.find((c) => c.id === op.corporate_body_id)?.name || '—'}
                          </TableCell>
                          <TableCell>{statusBadge(op.status)}</TableCell>
                          <TableCell className="text-right">
                            {(op.role || '').toLowerCase() === 'officer' ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                className="mr-2"
                                onClick={() => openEditOfficer(op.id, op.corporate_body_id)}
                              >
                                Edit
                              </Button>
                            ) : null}
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
