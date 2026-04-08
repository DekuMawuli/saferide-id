'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { fetchOperatorsList } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { ApiError, postAdminCreateUser } from '@/lib/api/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PLATFORM_ROLES = new Set(['admin', 'system_admin', 'monitor', 'support']);

function roleBadge(role: string) {
  const r = (role || '').toLowerCase();
  if (r === 'system_admin') return <Badge variant="destructive">System Admin</Badge>;
  if (r === 'admin') return <Badge variant="destructive">Admin</Badge>;
  if (r === 'monitor') return <Badge variant="secondary">Monitor</Badge>;
  if (r === 'support') return <Badge variant="secondary">Support</Badge>;
  return <Badge variant="outline">{role}</Badge>;
}

export default function AdminPlatformAdminsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('monitor');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchOperatorsList({ q: q.trim() || undefined, limit: 300 });
      setRows(data.filter((r) => PLATFORM_ROLES.has((r.operator.role || '').toLowerCase())));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load platform admins');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => void load(), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const createUser = async () => {
    setCreating(true);
    try {
      await postAdminCreateUser({
        email: email.trim(),
        password,
        full_name: fullName.trim() || null,
        role,
      });
      toast.success('Platform admin created');
      setOpen(false);
      setFullName('');
      setEmail('');
      setPassword('');
      setRole('monitor');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

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
          <h1 className="text-3xl font-bold text-indigo-950">Platform Admins</h1>
          <p className="text-muted-foreground">System administrators and staff-side platform users only.</p>
          <div className="mt-3">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button><Plus className="mr-2 h-4 w-4" />New Platform Admin</Button>} />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create platform admin</DialogTitle>
                  <DialogDescription>Create monitor/support/admin/system_admin account.</DialogDescription>
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
                    <Label>Role</Label>
                    <Select value={role} onValueChange={(v) => setRole(v || 'monitor')}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monitor">monitor</SelectItem>
                        <SelectItem value="support">support</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="system_admin">system_admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={() => void createUser()} disabled={creating || !email.trim() || !password}>
                    {creating ? 'Creating…' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Directory</CardTitle>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search admins…" className="pl-9" />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No platform admins found.</TableCell></TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.operator.id}>
                      <TableCell>{r.operator.full_name || r.operator.id.slice(0, 8)}</TableCell>
                      <TableCell>{r.operator.email || '—'}</TableCell>
                      <TableCell>{roleBadge(r.operator.role)}</TableCell>
                      <TableCell>{r.operator.status}</TableCell>
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
