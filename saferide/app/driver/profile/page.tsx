'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ShieldCheck, Car, MapPin, Clock, QrCode, AlertTriangle, Settings, LogOut, BadgeCheck, UserCheck } from 'lucide-react';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { useDriverData } from '@/hooks/use-driver-data';
import { useDriverConsents } from '@/app/driver/layout';
import { getPublicAppOrigin } from '@/lib/app-url';
import { fetchMyCredentials } from '@/lib/api/credentials';
import type { CredentialRecord } from '@/lib/api/credentials';


function initialsFromName(name: string | null | undefined): string {
  const t = (name ?? '').trim();
  if (!t) return '?';
  const parts = t.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

/** Matches backend `RideEvent.channel` (e.g. WEB, USSD). */
function formatRideChannel(channel: string): string {
  const c = (channel || '').trim().toUpperCase();
  if (c === 'WEB') return 'Web';
  if (c === 'USSD') return 'USSD';
  if (c === 'SMS') return 'SMS';
  return channel.trim() || '—';
}

export default function DriverProfilePage() {
  const { me, loading, error, signOut, hasToken, apiConfigured } = useOperatorSession();
  const apiOp = me?.authenticated && me.operator ? me.operator : null;
  const {
    activeBinding,
    rideEvents,
    associationLabel,
    fleetLoading,
    fleetError,
  } = useDriverData({
    operatorId: apiOp?.id,
    corporateBodyId: apiOp?.corporate_body_id ?? null,
    hasToken,
    apiConfigured,
  });
  const { consentRequests: consentOpen } = useDriverConsents();
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function loadCredentials() {
      if (!hasToken || !apiConfigured) {
        if (active) setCredentials([]);
        return;
      }
      try {
        const rows = await fetchMyCredentials();
        if (active) setCredentials(rows);
      } catch {
        if (active) setCredentials([]);
      }
    }

    void loadCredentials();
    return () => {
      active = false;
    };
  }, [hasToken, apiConfigured]);

  const trustEvents = useMemo(
    () => rideEvents.filter((e) => e.event_type === 'trust_verified'),
    [rideEvents],
  );
  const consentEvents = useMemo(
    () => rideEvents.filter((e) => e.event_type === 'consent_approved'),
    [rideEvents],
  );

  const displayName = apiOp?.full_name?.trim() || 'Driver';
  const displayPhoto = apiOp?.photo_ref?.trim() || null;
  const shortCode = apiOp?.verify_short_code?.trim();
  const displayCode = shortCode ?? (apiOp ? `${apiOp.external_subject_id.slice(0, 10)}…` : '—');
  const verifyUrl =
    shortCode && getPublicAppOrigin() ? `${getPublicAppOrigin()}/verify/result/${shortCode}` : '';
  const statusKey = (apiOp?.status ?? 'pending').toLowerCase();

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
        {apiConfigured && hasToken && (loading || fleetLoading) ? (
          <p className="text-sm text-muted-foreground mb-4">Loading your profile…</p>
        ) : null}
        {fleetError ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Fleet data</AlertTitle>
            <AlertDescription>{fleetError}</AlertDescription>
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
                  <div className="h-24 w-24 rounded-full border-4 border-white bg-slate-200 overflow-hidden flex items-center justify-center">
                    {displayPhoto ? (
                      <img src={displayPhoto} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold text-slate-500">{initialsFromName(displayName)}</span>
                    )}
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
                      <p className="text-muted-foreground">{associationLabel ?? '—'}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">IdP verification</p>
                      <p className={apiOp?.esignet_verified_at ? 'text-emerald-600' : 'text-amber-700'}>
                        {apiOp?.esignet_verified_at
                          ? `Last verified ${new Date(apiOp.esignet_verified_at).toLocaleString()}`
                          : 'Not verified yet (sign in with eSignet)'}
                      </p>
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
              <TabsList className="grid w-full grid-cols-4 mb-6 bg-slate-100">
                <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
                <TabsTrigger value="credentials">
                  Credentials
                  {credentials.length > 0 && (
                    <span className="ml-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white">
                      {credentials.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">License plate</p>
                          <p className="text-lg font-mono font-semibold text-indigo-950">
                            {activeBinding.plate ?? activeBinding.vehicle_display_name ?? '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Vehicle type</p>
                          <p className="text-lg font-medium text-slate-900 capitalize">
                            {activeBinding.vehicle_type ?? '—'}
                          </p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Make &amp; model</p>
                          <p className="text-lg font-medium text-slate-900">{activeBinding.make_model ?? '—'}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-500">Color</p>
                          <p className="text-lg font-medium text-slate-900 capitalize">{activeBinding.color ?? '—'}</p>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <p className="text-sm font-medium text-slate-500">Association</p>
                          <p className="text-lg font-medium text-slate-900">{activeBinding.corporate_body_name ?? associationLabel ?? '—'}</p>
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
                      <p className="text-muted-foreground text-sm">
                        Sign in to see your assigned vehicle from the server.
                      </p>
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
              
              <TabsContent value="credentials" className="space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BadgeCheck className="h-5 w-5 text-emerald-600" />
                      Verifiable Credentials
                    </CardTitle>
                    <CardDescription>
                      Credentials issued to your profile. Scan the QR with Inji Wallet to claim them.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {credentials.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No credentials issued yet. They are generated automatically when you sign in with eSignet.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {credentials.map((cred) => {
                          const claimLinks = cred.claim_links;
                          const deepLink = claimLinks?.wallet_deep_link ?? null;
                          return (
                            <div key={cred.id} className="rounded-lg border border-slate-200 p-4 space-y-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-medium text-slate-900">{cred.template_name ?? cred.credential_type}</p>
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{cred.id.slice(0, 16)}…</p>
                                </div>
                                <Badge className={
                                  cred.status === 'ISSUED'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                    : 'bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100'
                                }>
                                  {cred.status}
                                </Badge>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-6 items-start">
                                <div className="rounded-lg bg-white border border-slate-200 p-3 shadow-sm">
                                  {deepLink ? (
                                    <QRCodeSVG value={deepLink} size={140} level="M" />
                                  ) : (
                                    <div className="flex h-[140px] w-[140px] items-center justify-center rounded bg-slate-50 text-center text-xs text-slate-400">
                                      Claim link unavailable
                                    </div>
                                  )}
                                </div>
                                <div className="space-y-2 text-sm flex-1">
                                  <p className="font-medium text-slate-700">Claim in Inji Wallet</p>
                                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground text-xs">
                                    <li>Open Inji Wallet on your phone</li>
                                    <li>Tap <span className="font-medium text-slate-700">+ Add Credential</span></li>
                                    <li>Scan this QR code</li>
                                    <li>Authenticate with eSignet when prompted</li>
                                  </ol>
                                  {cred.issued_at ? (
                                    <p className="text-xs text-muted-foreground pt-1">
                                      Issued: {new Date(cred.issued_at).toLocaleString()}
                                    </p>
                                  ) : null}
                                  {claimLinks ? (
                                    <>
                                      <p className="text-[11px] text-slate-500">
                                        Issuer metadata:{' '}
                                        <span className="font-mono break-all">{claimLinks.issuer_metadata_url}</span>
                                      </p>
                                      {deepLink ? (
                                        <div className="flex flex-wrap gap-2 pt-2">
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="bg-indigo-600 text-white hover:bg-indigo-700"
                                            onClick={() => {
                                              window.location.href = deepLink;
                                            }}
                                          >
                                            Open wallet link
                                          </Button>
                                          {claimLinks.inji_web_url ? (
                                            <Button
                                              type="button"
                                              size="sm"
                                              variant="outline"
                                              onClick={() => window.open(claimLinks.inji_web_url!, '_blank', 'noopener,noreferrer')}
                                            >
                                              Open Inji Web
                                            </Button>
                                          ) : null}
                                        </div>
                                      ) : null}
                                      <p className="break-all font-mono text-[10px] text-slate-400 pt-1">
                                        {claimLinks.credential_configuration_id}
                                      </p>
                                    </>
                                  ) : (
                                    <p className="text-xs text-amber-700">
                                      Claim links are unavailable until the backend is configured with the Inji issuer URL.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
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
                    <CardDescription>
                      Passenger lookups of your verify code (recorded when someone opens your public trust page). Disclosure
                      approvals you make are listed separately below.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {!apiOp ? (
                      <p className="text-sm text-muted-foreground">Sign in to see verification activity.</p>
                    ) : (
                      <>
                        <div>
                          <h4 className="text-sm font-semibold text-slate-800 mb-3">Passenger code lookups</h4>
                          {trustEvents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No lookups yet. When a passenger checks your code on the web or via USSD/SMS, each view is
                              logged here.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {trustEvents.map((ev) => {
                                const when = new Date(ev.recorded_at);
                                return (
                                  <div
                                    key={ev.id}
                                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm text-slate-900">Verify code viewed</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {formatRideChannel(ev.channel)}
                                          {ev.passenger_msisdn ? ` · ${ev.passenger_msisdn}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                      <p className="text-sm font-medium text-slate-900">{when.toLocaleDateString()}</p>
                                      <p className="text-xs text-muted-foreground">{when.toLocaleTimeString()}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="border-t border-slate-100 pt-6">
                          <h4 className="text-sm font-semibold text-slate-800 mb-3">Disclosure approvals (by you)</h4>
                          {consentEvents.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No approvals yet. When you approve a passenger disclosure request on the consent screen, it
                              appears here — that is not the same as a code lookup above.
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {consentEvents.map((ev) => {
                                const when = new Date(ev.recorded_at);
                                return (
                                  <div
                                    key={ev.id}
                                    className="flex items-center justify-between p-3 bg-violet-50/80 rounded-lg border border-violet-100"
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                        <UserCheck className="h-4 w-4 text-violet-700" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-medium text-sm text-slate-900">You approved disclosure</p>
                                        <p className="text-xs text-muted-foreground truncate">
                                          {formatRideChannel(ev.channel)}
                                          {ev.passenger_msisdn ? ` · ${ev.passenger_msisdn}` : ''}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="text-right shrink-0 ml-2">
                                      <p className="text-sm font-medium text-slate-900">{when.toLocaleDateString()}</p>
                                      <p className="text-xs text-muted-foreground">{when.toLocaleTimeString()}</p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    )}
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
