'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Fingerprint, Lock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchMyConsentRequest, respondConsentRequest } from '@/lib/api/consent-driver';
import type { ConsentRequestItem } from '@/lib/api/types';
import { useOperatorSession } from '@/hooks/use-operator-session';

function ConsentInner() {
  const searchParams = useSearchParams();
  const requestId = searchParams.get('request');
  const { hasToken, apiConfigured } = useOperatorSession();
  const [req, setReq] = useState<ConsentRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!requestId || !apiConfigured || !hasToken) {
      setLoading(false);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const row = await fetchMyConsentRequest(requestId);
        if (!cancel) setReq(row);
      } catch (e) {
        if (!cancel) setError(e instanceof ApiError ? e.message : 'Failed to load request');
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [requestId, hasToken, apiConfigured]);

  const respond = async (approve: boolean) => {
    if (!requestId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await respondConsentRequest(requestId, approve);
      setDone(
        approve
          ? `Approved. Passenger can use disclosure token (expires ${res.disclosure_token_expires_at ?? '—'}).`
          : 'Request denied.',
      );
      setReq((r) => (r ? { ...r, status: res.status } : r));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  if (!requestId) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-md items-center justify-center px-4">
        <p className="text-muted-foreground text-center">
          Missing <code className="text-xs">?request=</code> id. Open a pending request from your profile.
        </p>
      </div>
    );
  }

  if (!apiConfigured || !hasToken) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 px-4">
        <p className="text-muted-foreground text-center">Sign in as the driver to respond.</p>
        <Link href="/login">
          <Button type="button">Login</Button>
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !req) {
    return (
      <div className="container mx-auto max-w-md px-4 py-12">
        <Card>
          <CardContent className="p-6 text-center text-red-600">{error || 'Not found'}</CardContent>
        </Card>
      </div>
    );
  }

  if (req.status !== 'pending') {
    return (
      <div className="container mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Already handled</CardTitle>
            <CardDescription>Status: {req.status}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Link href="/driver/profile">
              <Button variant="outline" type="button">
                Back to profile
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4">
        <Card className="w-full overflow-hidden border-0 shadow-lg">
          <div className="h-2 bg-indigo-600" />
          <CardContent className="flex flex-col items-center space-y-6 p-12 text-center">
            <div className="rounded-full bg-emerald-100 p-4">
              <CheckCircle2 className="h-16 w-16 text-emerald-600" />
            </div>
            <p className="text-muted-foreground">{done}</p>
            <Link href="/driver/profile">
              <Button type="button">Profile</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[80vh] max-w-md items-center justify-center px-4 py-8">
      <Card className="w-full overflow-hidden border-0 shadow-lg">
        <div className="h-2 bg-indigo-600" />
        <CardHeader className="pb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
            <ShieldCheck className="h-8 w-8 text-indigo-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-indigo-950">Disclosure request</CardTitle>
          <CardDescription className="mt-2 text-base">
            Channel: {req.channel}
            {req.passenger_msisdn ? ` · ${req.passenger_msisdn}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="flex items-center text-sm font-semibold text-slate-900">
              <Lock className="mr-2 h-4 w-4 text-slate-500" />
              If you approve, passenger receives:
            </h4>
            <ul className="list-disc space-y-2 pl-6 text-sm text-slate-600">
              <li>Phone number on file</li>
              <li>Last IdP verification time</li>
              <li>Masked national IdP subject hint</li>
            </ul>
            <p className="text-muted-foreground border-t border-slate-200 pt-4 text-xs">
              Code: <span className="font-mono font-medium">{req.verify_short_code}</span>
            </p>
          </div>
          {error ? <p className="text-center text-sm text-red-600">{error}</p> : null}
          <div className="flex flex-col items-center py-4">
            <Button
              type="button"
              disabled={busy}
              onClick={() => void respond(true)}
              className="flex h-24 w-24 flex-col items-center justify-center gap-2 rounded-full border-2 border-indigo-200 bg-indigo-50 text-indigo-700 transition-all hover:scale-105 hover:bg-indigo-100"
            >
              <Fingerprint className="h-8 w-8" />
              <span className="text-xs font-semibold">Approve</span>
            </Button>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 border-t bg-slate-50 p-6">
          <Button
            variant="outline"
            className="w-full border-red-200 text-red-700 hover:bg-red-50"
            disabled={busy}
            onClick={() => void respond(false)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Deny
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export default function DriverConsentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">Loading…</div>
      }
    >
      <ConsentInner />
    </Suspense>
  );
}
