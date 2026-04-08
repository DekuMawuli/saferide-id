'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Car,
  MapPin,
  Clock,
  Share2,
  AlertOctagon,
  ArrowLeft,
  Search,
  Phone,
  Loader2,
} from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { isApiConfigured } from '@/lib/api/config';
import {
  createConsentRequest,
  fetchTrustByCode,
  fetchVcProof,
  pollConsentStatus,
  postEmergencyShare,
} from '@/lib/api/public-trust';
import type { VcProofSummary } from '@/lib/api/public-trust';
import type { TrustPublicResponse } from '@/lib/api/types';

export default function VerificationResultPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const code = resolvedParams.id;
  const searchParams = useSearchParams();
  const initialDisclosureToken = searchParams.get('disclosure_token')?.trim() || null;
  const [loading, setLoading] = useState(() => isApiConfigured());
  const [trust, setTrust] = useState<TrustPublicResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [viewTier, setViewTier] = useState<'standard' | 'minimal'>('standard');
  const [disclosureToken, setDisclosureToken] = useState<string | null>(initialDisclosureToken);
  const [consentPolling, setConsentPolling] = useState(false);
  const [consentRequestId, setConsentRequestId] = useState<string | null>(null);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [panicMsisdn, setPanicMsisdn] = useState('');
  const [panicDone, setPanicDone] = useState<string | null>(null);
  const [vcProof, setVcProof] = useState<VcProofSummary | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reload trust data when code, tier, or disclosure token changes
  useEffect(() => {
    let cancelled = false;
    if (!isApiConfigured()) return;
    const tier = disclosureToken ? 'extended' : viewTier === 'minimal' ? 'minimal' : 'standard';
    fetchTrustByCode(code, { tier, disclosureToken: disclosureToken ?? undefined })
      .then((row) => {
        if (cancelled) return;
        setTrust(row);
        setNotFound(false);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 403) {
          setTrust(null); setForbidden(true); setNotFound(false);
        } else {
          setTrust(null); setNotFound(true);
        }
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [code, disclosureToken, viewTier]);

  // Fetch VC proof once per code
  useEffect(() => {
    if (!isApiConfigured()) return;
    fetchVcProof(code).then(setVcProof).catch(() => setVcProof(null));
  }, [code]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startConsentPoll = (rid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setConsentPolling(true);
    pollRef.current = setInterval(async () => {
      try {
        const st = await pollConsentStatus(rid);
        if (st.status === 'approved' && typeof st.disclosure_token === 'string') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setConsentPolling(false);
          setLoading(true);
          setForbidden(false);
          setDisclosureToken(st.disclosure_token as string);
          setConsentRequestId(null);
        }
        if (st.status === 'denied' || st.status === 'expired' || st.status === 'not_found') {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setConsentPolling(false);
          setConsentError(`Consent ${st.status}`);
        }
      } catch {
        /* keep polling */
      }
    }, 2500);
  };

  const requestExtended = async () => {
    setConsentError(null);
    try {
      const res = await createConsentRequest({
        verify_short_code: code,
        channel: 'web',
        passenger_msisdn: panicMsisdn.trim() || null,
      });
      setConsentRequestId(res.request_id);
      startConsentPoll(res.request_id);
    } catch (e) {
      setConsentError(e instanceof ApiError ? e.message : 'Failed to request consent');
    }
  };

  const onPanic = async () => {
    setPanicDone(null);
    try {
      const res = await postEmergencyShare({
        verify_short_code: code,
        sender_msisdn: panicMsisdn.trim() || null,
        note: 'verify_result_panic',
      });
      setPanicDone(`Simulated ${res.sms_simulated_count} SMS · ref ${res.share_id.slice(0, 8)}`);
    } catch (e) {
      setPanicDone(e instanceof ApiError ? e.message : 'Panic share failed');
    }
  };

  const band = trust?.trust_band;
  const isClear = band === 'CLEAR';
  const isBlock = band === 'BLOCK';

  const renderStatusBadge = () => {
    if (!trust) return null;
    const s = trust.status.toUpperCase();
    if (s === 'ACTIVE') {
      return (
        <Badge className="bg-emerald-500 px-3 py-1 text-sm hover:bg-emerald-600">
          <CheckCircle2 className="mr-1 h-4 w-4" /> ACTIVE
        </Badge>
      );
    }
    if (s === 'APPROVED') {
      return (
        <Badge className="bg-teal-600 px-3 py-1 text-sm hover:bg-teal-700">
          <CheckCircle2 className="mr-1 h-4 w-4" /> APPROVED
        </Badge>
      );
    }
    if (s === 'SUSPENDED') {
      return (
        <Badge variant="destructive" className="px-3 py-1 text-sm">
          <AlertTriangle className="mr-1 h-4 w-4" /> SUSPENDED
        </Badge>
      );
    }
    if (s === 'EXPIRED') {
      return (
        <Badge variant="outline" className="border-amber-500 px-3 py-1 text-sm text-amber-600">
          <Clock className="mr-1 h-4 w-4" /> EXPIRED
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="px-3 py-1 text-sm">
        {s}
      </Badge>
    );
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="container mx-auto max-w-lg flex-1 px-4 py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link
            href="/verify"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
          <Link href="/simulate/ussd" className="text-xs text-muted-foreground hover:text-indigo-600 hover:underline">
            USSD sim
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/simulate/sms" className="text-xs text-muted-foreground hover:text-indigo-600 hover:underline">
            SMS outbox
          </Link>
        </div>

        {!isApiConfigured() ? (
          <Alert className="border-amber-200 bg-amber-50 text-amber-900">
            <AlertTitle>API not configured</AlertTitle>
            <AlertDescription>
              Set <code className="text-xs">NEXT_PUBLIC_API_URL</code>.
            </AlertDescription>
          </Alert>
        ) : null}

        {forbidden ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Disclosure token invalid</AlertTitle>
            <AlertDescription>Ask the driver to approve a new request.</AlertDescription>
          </Alert>
        ) : null}

        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={viewTier === 'standard' ? 'default' : 'outline'}
            onClick={() => {
              setLoading(true);
              setForbidden(false);
              setDisclosureToken(null);
              setViewTier('standard');
            }}
            disabled={!!disclosureToken}
          >
            Standard view
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewTier === 'minimal' ? 'default' : 'outline'}
            onClick={() => {
              setLoading(true);
              setForbidden(false);
              setDisclosureToken(null);
              setViewTier('minimal');
            }}
            disabled={!!disclosureToken}
          >
            Minimal (USSD-style)
          </Button>
          {trust?.disclosure_tier === 'extended' ? (
            <Badge className="bg-violet-600">Extended disclosure</Badge>
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2 text-center">
                <Skeleton className="mx-auto mb-2 h-8 w-3/4" />
                <Skeleton className="mx-auto h-4 w-1/2" />
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <Skeleton className="h-32 w-32 rounded-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        ) : trust ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6 duration-500">
            {isClear ? (
              <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <AlertTitle className="font-bold text-emerald-800">Cleared to proceed</AlertTitle>
                <AlertDescription className="text-emerald-700">
                  Trust band CLEAR — follow local rules before boarding.
                </AlertDescription>
              </Alert>
            ) : isBlock ? (
              <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900">
                <XCircle className="h-5 w-5 text-red-600" />
                <AlertTitle className="font-bold text-red-800">Do not board</AlertTitle>
                <AlertDescription className="text-red-700">Trust band BLOCK.</AlertDescription>
              </Alert>
            ) : (
              <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <AlertTitle className="font-bold text-amber-800">Caution</AlertTitle>
                <AlertDescription className="text-amber-700">Trust band CAUTION.</AlertDescription>
              </Alert>
            )}

            <Card className="overflow-hidden border-0 shadow-lg">
              <div
                className={`h-3 ${isClear ? 'bg-emerald-500' : isBlock ? 'bg-red-500' : 'bg-amber-500'}`}
              />
              <CardHeader className="pb-2 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="relative">
                    {trust.photo_url ? (
                      <img
                        src={trust.photo_url}
                        alt=""
                        className="h-32 w-32 rounded-full border-4 border-white object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-32 w-32 items-center justify-center rounded-full border-4 border-white bg-slate-200 text-slate-500 text-sm">
                        No photo
                        <br />
                        <span className="text-xs">(minimal tier)</span>
                      </div>
                    )}
                    <div className="absolute -bottom-2 -right-2 rounded-full bg-white p-1 shadow-sm">
                      {isClear ? (
                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                      ) : isBlock ? (
                        <XCircle className="h-8 w-8 text-red-500" />
                      ) : (
                        <AlertTriangle className="h-8 w-8 text-amber-500" />
                      )}
                    </div>
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold text-indigo-950">
                  {trust.display_name?.trim() || 'Verified operator'}
                </CardTitle>
                <CardDescription className="text-lg font-medium text-slate-600">
                  Code: <span className="font-bold text-indigo-900">{code.toUpperCase()}</span>
                </CardDescription>
                <div className="mt-2">{renderStatusBadge()}</div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <Car className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                    <div>
                      <p className="text-sm font-medium text-slate-500">Authorized vehicle(s)</p>
                      {trust.vehicles.length ? (
                        <ul className="mt-1 space-y-1">
                          {trust.vehicles.map((v, i) => (
                            <li key={i} className="font-semibold text-indigo-950">
                              {v.plate ?? v.display_name ?? '—'}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 font-medium text-slate-700">No vehicle on file</p>
                      )}
                    </div>
                  </div>

                  {trust.operator_id ? (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Record</p>
                        <p className="font-mono text-xs text-slate-600">{trust.operator_id}</p>
                      </div>
                    </div>
                  ) : null}

                  {trust.phone ? (
                    <div className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <Phone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-500">Phone (consented)</p>
                        <p className="font-semibold text-indigo-950">{trust.phone}</p>
                      </div>
                    </div>
                  ) : null}

                  {trust.esignet_verified_at ? (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                      <span className="font-medium">Last IdP sync: </span>
                      {trust.esignet_verified_at}
                    </div>
                  ) : null}
                  {trust.external_subject_hint ? (
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                      Subject hint: {trust.external_subject_hint}
                    </div>
                  ) : null}
                </div>

                {vcProof !== null && (
                  <div className={`flex items-start gap-3 rounded-lg border p-3 ${vcProof.vc_issued ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                    <ShieldCheck className={`mt-0.5 h-5 w-5 shrink-0 ${vcProof.vc_issued ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold ${vcProof.vc_issued ? 'text-emerald-800' : 'text-slate-600'}`}>
                        {vcProof.vc_issued ? 'Cryptographic credential issued' : 'No verifiable credential on file'}
                      </p>
                      {vcProof.vc_issued && (
                        <div className="mt-1 space-y-0.5 text-xs text-emerald-700">
                          <p>Issuer: <span className="font-mono">{vcProof.issuer}</span></p>
                          <p>Type: <span className="font-mono">{vcProof.template_name ?? vcProof.credential_type}</span></p>
                          {vcProof.issued_at && <p>Issued: {new Date(vcProof.issued_at).toLocaleString()}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <Card className="border-indigo-100 bg-indigo-50/50">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Extended disclosure (Milestone 3)</CardTitle>
                    <CardDescription>
                      Request unlock; driver approves in app. Polls <code className="text-xs">/public/consent/status</code>{' '}
                      — no passenger login.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {consentError ? <p className="text-sm text-red-600">{consentError}</p> : null}
                    {consentPolling || consentRequestId ? (
                      <p className="text-muted-foreground flex items-center gap-2 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Waiting for driver… request {consentRequestId?.slice(0, 8)}
                      </p>
                    ) : null}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={consentPolling || !!disclosureToken}
                      onClick={() => void requestExtended()}
                    >
                      Request phone + verified details
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-red-100 bg-red-50/40">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base text-red-900">Panic share (Milestone 5)</CardTitle>
                    <CardDescription>
                      Logs an emergency row and simulates SMS to{' '}
                      <code className="text-xs">SIM_EMERGENCY_SMS_RECIPIENTS</code> — no auth.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">Your MSISDN (optional, for SMS body)</Label>
                      <Input
                        value={panicMsisdn}
                        onChange={(e) => setPanicMsisdn(e.target.value)}
                        placeholder="+256…"
                        className="font-mono text-sm"
                      />
                    </div>
                    <Button type="button" variant="destructive" onClick={() => void onPanic()}>
                      <AlertOctagon className="mr-2 h-4 w-4" />
                      Share driver reference (panic)
                    </Button>
                    {panicDone ? <p className="text-sm text-slate-700">{panicDone}</p> : null}
                  </CardContent>
                </Card>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 border-t bg-slate-50 p-6">
                <Link href={`/share-trip?op=${encodeURIComponent(code)}`} className="w-full">
                  <Button variant="outline" className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                    <Share2 className="mr-2 h-4 w-4" />
                    Share trip details
                  </Button>
                </Link>
                <Link href={`/report?op=${encodeURIComponent(code)}`} className="w-full">
                  <Button variant="ghost" className="w-full text-red-600 hover:bg-red-50 hover:text-red-700">
                    <AlertOctagon className="mr-2 h-4 w-4" />
                    Report an issue
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          </div>
        ) : notFound ? (
          <div className="animate-in fade-in space-y-6 duration-500">
            <Alert variant="destructive" className="border-red-200 bg-red-50 text-red-900">
              <XCircle className="h-5 w-5 text-red-600" />
              <AlertTitle className="font-bold text-red-800">Operator not found</AlertTitle>
              <AlertDescription className="text-red-700">No trust record for code &quot;{code}&quot;.</AlertDescription>
            </Alert>
            <Card className="border-0 shadow-md">
              <CardContent className="flex flex-col items-center space-y-4 p-8 text-center">
                <Link href="/verify" className="w-full">
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                    <Search className="mr-2 h-4 w-4" />
                    Verify another driver
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
