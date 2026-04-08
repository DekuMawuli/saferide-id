'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Car, AlertCircle, CheckCircle2, ArrowLeft, Loader2 } from 'lucide-react';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { useDriverData } from '@/hooks/use-driver-data';

export default function DriverVehiclePage() {
  const { me, hasToken, apiConfigured } = useOperatorSession();
  const apiOp = me?.authenticated && me.operator ? me.operator : null;
  const { activeBinding, associationLabel, fleetLoading, fleetError } = useDriverData({
    operatorId: apiOp?.id,
    corporateBodyId: apiOp?.corporate_body_id ?? null,
    hasToken,
    apiConfigured,
  });

  const lastVerified =
    activeBinding?.vehicle_updated_at ?? activeBinding?.binding.updated_at ?? null;

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
        <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Assigned Vehicle</h1>
        <p className="text-muted-foreground mt-1">View the vehicle currently bound to your SafeRide profile.</p>
      </div>

      {!apiConfigured ? (
        <Alert className="mb-6 border-amber-200 bg-amber-50/80">
          <AlertTitle className="text-amber-900">API not configured</AlertTitle>
          <AlertDescription className="text-amber-800">
            Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> and sign in to load your vehicle.
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
            to see your assigned vehicle.
          </AlertDescription>
        </Alert>
      ) : null}

      {fleetError ? (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Could not load vehicle</AlertTitle>
          <AlertDescription>{fleetError}</AlertDescription>
        </Alert>
      ) : null}

      {fleetLoading && hasToken ? (
        <div className="flex items-center gap-2 text-muted-foreground mb-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading vehicle…
        </div>
      ) : null}

      <div className="space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4 border-b border-slate-100">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Car className="h-6 w-6 text-indigo-600" />
                Vehicle Details
              </CardTitle>
              {activeBinding ? (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active Assignment
                </Badge>
              ) : apiOp ? (
                <Badge variant="outline" className="text-slate-600">
                  No active binding
                </Badge>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {activeBinding ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">License Plate</p>
                  <p className="text-2xl font-mono font-bold text-indigo-950">
                    {activeBinding.plate ?? activeBinding.vehicle_display_name ?? '—'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Vehicle Type</p>
                  <p className="text-lg font-medium text-slate-900 capitalize">{activeBinding.vehicle_type ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Make &amp; Model</p>
                  <p className="text-lg font-medium text-slate-900">{activeBinding.make_model ?? '—'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Color</p>
                  <p className="text-lg font-medium text-slate-900 capitalize">{activeBinding.color ?? '—'}</p>
                </div>
              </div>
            ) : apiOp ? (
              <p className="text-muted-foreground text-sm">
                No vehicle is bound to your profile yet. Ask your association officer to assign one in the portal.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">Sign in to see your assigned vehicle.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm bg-indigo-50">
          <CardHeader>
            <CardTitle className="text-indigo-900 text-lg">Authorization Status</CardTitle>
            <CardDescription className="text-indigo-700">
              This vehicle is authorized for your use by your association.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-white rounded-lg border border-indigo-100">
              <div>
                <p className="font-medium text-slate-900">Association</p>
                <p className="text-sm text-muted-foreground">
                  {activeBinding?.corporate_body_name?.trim() || associationLabel || '—'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="font-medium text-slate-900">Last updated</p>
                <p className="text-sm text-muted-foreground">
                  {lastVerified
                    ? new Date(lastVerified).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex gap-4 items-start">
          <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-3">
            <div>
              <h4 className="text-base font-semibold text-amber-900">Are these details incorrect?</h4>
              <p className="text-sm text-amber-800 mt-1">
                If you have changed vehicles or notice an error in these details, you must request a correction.
                Operating a vehicle that does not match your SafeRide profile may result in suspension.
              </p>
            </div>
            <Button variant="outline" className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100" type="button">
              Request Correction
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
