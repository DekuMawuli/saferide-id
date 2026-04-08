'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Building } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, postAdminLogin } from '@/lib/api/client';
import { useOperatorSession } from '@/hooks/use-operator-session';

const ALLOWED = new Set(['monitor', 'support', 'officer', 'admin', 'system_admin']);
const TARGET_BY_ROLE: Record<string, string> = {
  monitor: '/admin',
  support: '/portal',
  officer: '/portal',
  admin: '/admin',
  system_admin: '/admin',
};

export default function CorporateLoginPage() {
  const router = useRouter();
  const { saveToken } = useOperatorSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await postAdminLogin(email, password);
      const role = (res.role || res.operator?.role || '').toLowerCase();
      if (!ALLOWED.has(role)) {
        setError('This path is for corporate/staff accounts only.');
        return;
      }
      saveToken(res.access_token);
      router.push(TARGET_BY_ROLE[role] || '/portal');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex justify-center items-center gap-2 mb-4">
          <ShieldCheck className="h-10 w-10 text-indigo-600" />
          <span className="text-3xl font-bold text-indigo-950 tracking-tight">SafeRide</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Corporate login</h2>
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" /> Staff portal access</CardTitle>
            <CardDescription>For officers, support, and monitoring personnel.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-3">
              <div className="space-y-1">
                <Label>Email</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
              </div>
              <div className="space-y-1">
                <Label>Password</Label>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading || !email || !password}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <Link href="/login" className="mt-3 inline-block text-sm text-indigo-700 hover:underline">← Back to login options</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
