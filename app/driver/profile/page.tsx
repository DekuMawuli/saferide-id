'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, Car, MapPin, Clock, QrCode, AlertTriangle, Settings, LogOut } from 'lucide-react';
import { mockOperators } from '@/lib/mock-data';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { isApiConfigured } from '@/lib/api/config';
import { ApiError } from '@/lib/api/client';
import { fetchMyConsentRequests } from '@/lib/api/consent-driver';
import { fetchOperatorVehicleBindings } from '@/lib/api/governance';
import { getPublicAppOrigin } from '@/lib/app-url';
import type { ConsentRequestItem, OperatorVehicleBindingListItem } from '@/lib/api/types';

export default function DriverProfilePage() {
  const { me, loading, error, signOut, hasToken, apiConfigured } = useOperatorSession();
  const apiOp = me?.authenticated && me.operator ? me.operator : null;
  const driver = mockOperators[0];
  const [bindings, setBindings] = useState<OperatorVehicleBindingListItem[]>([]);
  const [bindErr, setBindErr] = useState<string | null>(null);
  const [consentOpen, setConsentOpen] = useState<ConsentRequestItem[]>([]);

  const loadBindings = useCallback(async () => {
    if (!apiOp?.id) return;
    setBindErr(null);
    try {
      const b = await fetchOperatorVehicleBindings(apiOp.id);
      setBindings(b);
    } catch (e) {
      setBindings([]);
      setBindErr(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Could not load vehicles');
    }
  }, [apiOp?.id]);

  useEffect(() => {
    if (apiOp?.id) void loadBindings();
    else setBindings([]);
  }, [apiOp?.id, loadBindings]);

  const loadConsents = useCallback(async () => {
    if (!hasToken || !apiConfigured) {
      setConsentOpen([]);
      return;
    }
    try {
      const rows = await fetchMyConsentRequests();
      setConsentOpen(rows);
    } catch {
      setConsentOpen([]);
    }
  }, [hasToken, apiConfigured]);

  useEffect(() => {
    void loadConsents();
  }, [loadConsents]);

  const displayName = apiOp?.full_name?.trim() || `${driver.firstName} ${driver.lastName}`;
  const displayPhoto = apiOp?.photo_ref || driver.photoUrl;
  const shortCode = apiOp?.verify_short_code?.trim();
  const displayCode = shortCode ?? (apiOp ? `${apiOp.external_subject_id.slice(0, 10)}…` : driver.code);
  const verifyUrl =
    shortCode && getPublicAppOrigin() ? `${getPublicAppOrigin()}/verify/result/${shortCode}` : '';
  const statusKey = (apiOp?.status ?? driver.status).toLowerCase();
  const activeBinding = bindings.find((b) => b.binding.is_active);

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'approved':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pending</Badge>;
      case 'suspended':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Suspended</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto">
        {apiConfigured && error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>API session</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        {apiConfigured && hasToken && loading ? (
          <p className="text-sm text-muted-foreground mb-4">Loading operator from API…</p>
        ) : null}
        {apiOp ? (
          <Alert className="mb-6 border-emerald-200 bg-emerald-50/80">
            <AlertTitle className="text-emerald-900">Connected to backend</AlertTitle>
            <AlertDescription className="text-emerald-800">
              Profile and vehicle bindings load from <code className="text-xs">GET /auth/me</code> and{' '}
              <code className="text-xs">GET /operators/…/vehicle-bindings</code>. Scan history remains demo.
            </AlertDescription>
          </Alert>
        ) : null}
        {bindErr ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Vehicle bindings</AlertTitle>
            <AlertDescription>{bindErr}</AlertDescription>
          </Alert>
        ) : null}
        {consentOpen.length > 0 ? (
          <Alert className="mb-6 border-violet-200 bg-violet-50/90">
            <AlertTitle className="text-violet-950">Passenger disclosure requests</AlertTitle>
            <AlertDescription className="text-violet-900">
              <ul className="mt-2 space-y-2">
                {consentOpen.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-mono">{c.verify_short_code}</span>
                    <span className="text-muted-foreground">{c.channel}</span>
                    <Link
                      href={`/driver/consent?request=${c.id}`}
                      className="font-medium text-violet-700 underline"
                    >
                      Review
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        {!apiConfigured ? (
          <Alert className="mb-6 border-amber-200 bg-amber-50/80">
            <AlertTitle className="text-amber-900">API not configured</AlertTitle>
            <AlertDescription className="text-amber-800">
              Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> and sign in via{' '}
              <Link href="/login" className="underline font-medium">
                Login
              </Link>{' '}
              to load your operator from the FastAPI backend.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-950">My Profile</h1>
            <p className="text-muted-foreground mt-1">Manage your SafeRide account and view your verification status.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="bg-white text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Profile Card & QR */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm overflow-hidden">
              <div className="h-24 bg-indigo-950"></div>
              <CardContent className="pt-0 relative">
                <div className="flex justify-between items-end -mt-12 mb-4">
                  <div className="h-24 w-24 rounded-full border-4 border-white bg-slate-200 overflow-hidden">
                    <img src={displayPhoto} alt="Profile" className="h-full w-full object-cover" />
                  </div>
                  <div className="pb-2">
                    {renderStatusBadge(statusKey)}
                  </div>
                </div>
                
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-indigo-950">{displayName}</h2>
                  <p className="text-muted-foreground font-mono text-sm">{displayCode}</p>
                  {apiOp?.phone ? (
                    <p className="text-sm text-muted-foreground">{apiOp.phone}</p>
                  ) : null}
                </div>
                
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-slate-500" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Association</p>
                      <p className="text-muted-foreground">{driver.association}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">Verification Status</p>
                      <p className="text-emerald-600">Verified by NIRA</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm bg-indigo-600 text-white">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-indigo-50 flex items-center gap-2">
                  <QrCode className="h-5 w-5" />
                  My SafeRide Code
                </CardTitle>
                <CardDescription className="text-indigo-200">
                  Show this to passengers to verify your identity.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center pt-4">
                <div className="mb-4 rounded-xl bg-white p-4 shadow-inner">
                  {verifyUrl ? (
                    <QRCodeSVG value={verifyUrl} size={160} level="M" />
                  ) : (
                    <QrCode className="h-40 w-40 text-indigo-950/40" />
                  )}
                </div>
                <p className="font-mono text-2xl font-bold tracking-widest">{displayCode}</p>
                {!verifyUrl ? (
                  <p className="mt-2 text-center text-xs text-indigo-200">
                    QR appears when an officer sets your status to APPROVED or ACTIVE and a short code is issued.
                  </p>
                ) : null}
                {verifyUrl ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mt-6 w-full bg-white text-indigo-600 hover:bg-indigo-50"
                    onClick={() => window.open(verifyUrl, '_blank', 'noopener,noreferrer')}
                  >
                    Open verify link
                  </Button>
                ) : (
                  <Button variant="secondary" className="mt-6 w-full bg-white/60 text-indigo-400" disabled>
                    Open verify link
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Details Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="vehicle" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6 bg-slate-100">
                <TabsTrigger value="vehicle">Vehicle Details</TabsTrigger>
                <TabsTrigger value="history">Scan History</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="vehicle" className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Car className="h-5 w-5 text-indigo-600" />
                      Assigned Vehicle
                    </CardTitle>
                    <CardDescription>The vehicle currently bound to your profile.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {activeBinding ? (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">License plate</p>
                          <p className="text-lg font-mono font-semibold text-indigo-950">
                            {activeBinding.plate ?? activeBinding.vehicle_display_name ?? '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Binding</p>
                          <p className="break-all font-mono text-xs text-slate-900">{activeBinding.binding.id}</p>
                        </div>
                      </div>
                    ) : apiOp ? (
                      <p className="text-muted-foreground text-sm">
                        No active vehicle binding. Ask your association officer to bind a plate under{' '}
                        <Link href="/portal/vehicles" className="text-indigo-600 underline">
                          Vehicles
                        </Link>
                        .
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">License Plate</p>
                          <p className="text-lg font-mono font-semibold text-indigo-950">{driver.vehicle.plate}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Category</p>
                          <p className="text-lg font-medium text-slate-900 capitalize">{driver.vehicle.category}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Make & Model</p>
                          <p className="text-lg font-medium text-slate-900">{driver.vehicle.makeModel}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Color</p>
                          <p className="text-lg font-medium text-slate-900 capitalize">{driver.vehicle.color}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="pt-6 border-t border-slate-100">
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                        <div>
                          <h4 className="text-sm font-semibold text-amber-800">Vehicle Change Request</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            If you need to change your assigned vehicle, please contact your association officer. You cannot update vehicle details yourself.
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="history" className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-indigo-600" />
                      Recent Scans
                    </CardTitle>
                    <CardDescription>A log of when passengers verified your profile.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                              <ShieldCheck className="h-4 w-4 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-sm text-slate-900">Successful Verification</p>
                              <p className="text-xs text-muted-foreground">Passenger Scan</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-slate-900">Today</p>
                            <p className="text-xs text-muted-foreground">08:{45 - i * 5} AM</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="settings" className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-indigo-600" />
                      Account Settings
                    </CardTitle>
                    <CardDescription>Manage your preferences and privacy.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-slate-900">Notification Preferences</h4>
                          <p className="text-sm text-muted-foreground">Receive SMS alerts for new verifications.</p>
                        </div>
                        <Button variant="outline">Configure</Button>
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                        <div>
                          <h4 className="font-medium text-slate-900">Privacy Controls</h4>
                          <p className="text-sm text-muted-foreground">Manage what data is shared during scans.</p>
                        </div>
                        <Button variant="outline">Manage</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
  );
}
