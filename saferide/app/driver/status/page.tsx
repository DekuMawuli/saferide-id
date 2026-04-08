'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calendar, RefreshCw, ArrowLeft, Loader2 } from 'lucide-react';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { useDriverData } from '@/hooks/use-driver-data';

export default function DriverStatusPage() {
  const { me, hasToken, apiConfigured } = useOperatorSession();
  const apiOp = me?.authenticated && me.operator ? me.operator : null;
  const { activeBinding, fleetLoading, fleetError, associationLabel } = useDriverData({
    operatorId: apiOp?.id,
    corporateBodyId: apiOp?.corporate_body_id ?? null,
    hasToken,
    apiConfigured,
  });

  const renderStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    switch (s) {
      case 'active':
      case 'approved':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active</Badge>
        );
      case 'suspended':
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">
            Suspended
          </Badge>
        );
      case 'expired':
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">
            Expired
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pending</Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const status = apiOp?.status ?? '—';
  const barClass =
    status.toLowerCase() === 'active' || status.toLowerCase() === 'approved'
      ? 'bg-emerald-500'
      : status.toLowerCase() === 'suspended'
        ? 'bg-red-500'
        : 'bg-amber-500';

  const created = apiOp?.created_at ? new Date(apiOp.created_at) : null;
  const updated = apiOp?.updated_at ? new Date(apiOp.updated_at) : null;
  const esignet = apiOp?.esignet_verified_at ? new Date(apiOp.esignet_verified_at) : null;
  const bindingFrom = activeBinding?.binding.valid_from
    ? new Date(activeBinding.binding.valid_from)
    : activeBinding?.binding.created_at
      ? new Date(activeBinding.binding.created_at)
      : null;

  return (
    <div className="container mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/driver/profile"
          className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Profile
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Verification Status</h1>
        <p className="text-muted-foreground mt-1">Review your current SafeRide credentials and compliance state.</p>
      </div>

      {!apiConfigured ? (
        <Alert className="mb-6 border-amber-200 bg-amber-50/80">
          <AlertTitle className="text-amber-900">API not configured</AlertTitle>
          <AlertDescription className="text-amber-800">
            Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> and sign in to load your status.
          </AlertDescription>
        </Alert>
      ) : null}

      {!hasToken ? (
        <Alert className="mb-6">
          <AlertTitle>Sign in required</AlertTitle>
          <AlertDescription>
            <Link href="/login/driver" className="text-indigo-600 underline font-medium">
              Driver login
            </Link>{' '}
            to see your verification status.
          </AlertDescription>
        </Alert>
      ) : null}

      {fleetError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Could not load fleet context</AlertTitle>
          <AlertDescription>{fleetError}</AlertDescription>
        </Alert>
      ) : null}

      {fleetLoading && hasToken ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className={`h-2 ${apiOp ? barClass : 'bg-slate-300'}`} />
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-xl font-bold text-slate-800">Current Status</CardTitle>
              {apiOp ? renderStatusBadge(status) : <Badge variant="outline">—</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> Registered
                </p>
                <p className="text-lg font-medium text-slate-900">
                  {created ? created.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                  <Calendar className="h-4 w-4" /> IdP verified
                </p>
                <p className="text-lg font-medium text-slate-900">
                  {esignet ? esignet.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                  <RefreshCw className="h-4 w-4" /> Profile updated
                </p>
                <p className="text-lg font-medium text-slate-900">
                  {updated ? updated.toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-800">Validity Timeline</CardTitle>
            <CardDescription>Milestones from your account and vehicle records.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white" />
                <h4 className="font-semibold text-slate-900">Account registered</h4>
                <p className="text-sm text-muted-foreground">Your SafeRide operator profile was created.</p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {created ? created.toLocaleString() : '—'}
                </span>
              </div>
              <div className="relative pl-6">
                <div
                  className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white ${
                    esignet ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
                <h4 className="font-semibold text-slate-900">Identity (eSignet)</h4>
                <p className="text-sm text-muted-foreground">
                  {esignet
                    ? `Verified at ${esignet.toLocaleString()}`
                    : 'Complete eSignet sign-in to record verification time.'}
                </p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {esignet ? esignet.toLocaleDateString() : '—'}
                </span>
              </div>
              <div className="relative pl-6">
                <div
                  className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white ${
                    activeBinding ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                />
                <h4 className="font-semibold text-slate-900">Vehicle bound</h4>
                <p className="text-sm text-muted-foreground">
                  {activeBinding
                    ? `Active binding to plate ${activeBinding.plate ?? activeBinding.vehicle_display_name ?? '—'}.`
                    : 'No active vehicle binding yet.'}
                </p>
                <span className="text-xs text-slate-500 mt-1 block">
                  {bindingFrom ? bindingFrom.toLocaleString() : '—'}
                </span>
              </div>
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-slate-300 border-2 border-white" />
                <h4 className="font-semibold text-slate-900">Association</h4>
                <p className="text-sm text-muted-foreground">
                  {associationLabel ?? activeBinding?.corporate_body_name ?? 'Not linked to an association name in your profile.'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="space-y-1">
            <h4 className="text-base font-semibold text-indigo-900">Need Help?</h4>
            <p className="text-sm text-indigo-800">
              If your status is incorrect or you need to update your vehicle, contact your association officer.
            </p>
          </div>
          <Button variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100 shrink-0" type="button">
            Contact Support
          </Button>
        </div>
      </div>
    </div>
  );
}
