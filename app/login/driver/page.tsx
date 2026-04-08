'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, postDriverLogin, setAccessToken } from '@/lib/api/client';
import { isApiConfigured, getApiBaseUrl } from '@/lib/api/config';

export default function DriverLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const desc = q.get('error_description') || q.get('error');
    if (desc) {
      setError(desc);
      window.history.replaceState(null, '', '/login/driver');
    }
  }, []);

  const onSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await postDriverLogin(phone.trim(), password);
      setAccessToken(res.access_token);
      router.replace('/driver/profile');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const esignetHref = isApiConfigured()
    ? `${getApiBaseUrl()}/auth/esignet/login?next=${encodeURIComponent('/driver/profile')}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex justify-center items-center gap-2 mb-4">
          <ShieldCheck className="h-10 w-10 text-indigo-600" />
          <span className="text-3xl font-bold text-indigo-950 tracking-tight">SafeRide</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Driver sign in</h2>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5" /> Sign in
            </CardTitle>
            <CardDescription>Use your registered phone number and password.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isApiConfigured() ? (
              <p className="text-sm text-amber-800">Set <code className="text-xs">NEXT_PUBLIC_API_URL</code> to enable login.</p>
            ) : (
              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+254…"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                {error ? <p className="text-sm text-red-600">{error}</p> : null}
                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  disabled={busy || !phone.trim() || !password}
                >
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
                <p className="text-xs text-muted-foreground text-center pt-1">
                  Default password: last 6 digits of your phone number
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
