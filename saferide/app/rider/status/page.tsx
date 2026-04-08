'use client';

import { useOperatorSession } from '@/hooks/use-operator-session';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Clock, AlertTriangle, IdCard, User, Calendar } from 'lucide-react';

function statusBadge(statusRaw: string | null | undefined) {
  const status = (statusRaw || 'PENDING').toUpperCase();
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return <Badge className="border-emerald-200 bg-emerald-100 text-emerald-800">Active</Badge>;
  }
  if (status === 'PENDING') {
    return <Badge className="border-amber-200 bg-amber-100 text-amber-800">Pending</Badge>;
  }
  if (status === 'SUSPENDED') {
    return <Badge variant="destructive">Suspended</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function RiderStatusPage() {
  const { me, loading, signOut } = useOperatorSession();
  const op = me?.authenticated ? me.operator : null;
  const status = (op?.status || 'PENDING').toUpperCase();
  const isActive = status === 'ACTIVE' || status === 'APPROVED';

  if (loading) {
    return <div className="text-muted-foreground">Loading rider status…</div>;
  }

  return (
    <div className="container mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Rider Status</h1>
        <p className="mt-1 text-muted-foreground">See your onboarding and account readiness.</p>
      </div>

      <Card className="mb-6 border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Account verification
            </CardTitle>
            {statusBadge(op?.status)}
          </div>
          <CardDescription>
            {isActive
              ? 'Your rider account is active. You can view your card details below.'
              : 'Your rider account is pending activation. Complete eSignet verification via your officer/admin.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-700">
          <p className="flex items-center gap-2">
            <User className="h-4 w-4 text-slate-500" />
            <span className="font-medium">Name:</span> {op?.full_name || '—'}
          </p>
          <p className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-500" />
            <span className="font-medium">Last identity verification:</span> {op?.esignet_verified_at || 'Not yet verified'}
          </p>
        </CardContent>
      </Card>

      {isActive ? (
        <Card className="border-emerald-100 bg-emerald-50/40 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-900">
              <IdCard className="h-5 w-5" />
              Rider card info
            </CardTitle>
            <CardDescription>Your current trust/card details available in SafeRide.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <p><span className="font-medium">Rider ID:</span> {op?.id || '—'}</p>
            <p><span className="font-medium">Email:</span> {op?.email || '—'}</p>
            <p><span className="font-medium">Phone:</span> {op?.phone || '—'}</p>
            <p><span className="font-medium">Role:</span> {op?.role || 'passenger'}</p>
            <p><span className="font-medium">Verification status:</span> {status}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 shadow-sm">
          <CardContent className="flex items-start gap-3 p-6 text-amber-900">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Activation pending</p>
              <p className="text-sm">
                Your officer/admin must initiate and complete eSignet verification before your rider card details are unlocked.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-6">
        <Button variant="outline" onClick={signOut} className="inline-flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
