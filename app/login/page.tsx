'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShieldCheck, User, Car, Building, ShieldAlert, ArrowRight, Link2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getApiBaseUrl, isApiConfigured } from '@/lib/api/config';
import { useOperatorSession } from '@/hooks/use-operator-session';

const roles = [
  {
    id: 'passenger',
    title: 'Passenger',
    description: 'Verify drivers and report incidents.',
    icon: User,
    href: '/',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'driver',
    title: 'Driver / Operator',
    description: 'Manage your profile and vehicle.',
    icon: Car,
    href: '/driver/profile',
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'officer',
    title: 'Association Officer',
    description: 'Manage operators and issue badges.',
    icon: Building,
    href: '/portal',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'admin',
    title: 'System Administrator',
    description: 'Platform oversight and settings.',
    icon: ShieldAlert,
    href: '/admin',
    color: 'bg-indigo-100 text-indigo-700',
  }
];

export default function LoginPage() {
  const router = useRouter();
  const { saveToken } = useOperatorSession();
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const apiBase = isApiConfigured() ? getApiBaseUrl() : '';
  const selected = roles.find((r) => r.id === selectedRole);
  const nextQuery =
    selected && apiBase ? `?next=${encodeURIComponent(selected.href)}` : '';
  const esignetLoginHref = apiBase ? `${apiBase}/auth/esignet/login${nextQuery}` : '';

  const handleLogin = (href: string) => {
    setIsLoading(true);
    setTimeout(() => {
      router.push(href);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex justify-center items-center gap-2 mb-4 hover:opacity-90 transition-opacity">
          <ShieldCheck className="h-10 w-10 text-indigo-600" />
          <span className="text-3xl font-bold text-indigo-950 tracking-tight">SafeRide</span>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign in to your account
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Select your role to access the appropriate portal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-8 px-4 shadow sm:rounded-xl sm:px-10 border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {roles.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <Card 
                  key={role.id}
                  className={`cursor-pointer transition-all hover:border-indigo-300 hover:shadow-md ${isSelected ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/50' : 'border-slate-200'}`}
                  onClick={() => setSelectedRole(role.id)}
                >
                  <CardContent className="p-5 flex flex-col items-start gap-3">
                    <div className={`p-2 rounded-lg ${role.color}`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{role.title}</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{role.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100">
            <Button 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-11 text-base"
              disabled={!selectedRole || isLoading}
              onClick={() => {
                const role = roles.find(r => r.id === selectedRole);
                if (role) handleLogin(role.href);
              }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Continue to Portal <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </div>

          <Card className="mt-8 border-indigo-200 bg-indigo-50/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-indigo-950">
                <Link2 className="h-4 w-4" />
                Backend API (eSignet)
              </CardTitle>
              <CardDescription className="text-indigo-900/70">
                SafeRide API issues sessions after MOSIP eSignet. Use the same host as{' '}
                <code className="text-xs bg-white/80 px-1 rounded">NEXT_PUBLIC_API_URL</code> in{' '}
                <code className="text-xs bg-white/80 px-1 rounded">.env.local</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!apiBase ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                  Set <strong>NEXT_PUBLIC_API_URL</strong> (e.g. <code>http://127.0.0.1:8000</code>) to enable
                  eSignet login.
                </p>
              ) : !selectedRole ? (
                <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                  Select a role above first. The API will redirect you to the matching area after eSignet (RBAC).
                </p>
              ) : (
                <a
                  href={esignetLoginHref}
                  className="inline-flex w-full items-center justify-center rounded-md bg-indigo-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-800"
                >
                  Sign in with eSignet (opens API)
                </a>
              )}
              <p className="text-xs text-slate-600">
                After eSignet, the API redirects to this app with the token in the URL hash (or use{' '}
                <code className="text-[11px]">?response_mode=json</code> on the callback for raw JSON).
              </p>
              <div className="space-y-2">
                <Label htmlFor="api-token" className="flex items-center gap-2 text-slate-700">
                  <KeyRound className="h-3.5 w-3.5" />
                  Save API access token
                </Label>
                <Input
                  id="api-token"
                  type="password"
                  autoComplete="off"
                  placeholder="Paste bearer token from callback JSON"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  className="font-mono text-sm bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-indigo-300"
                  disabled={!tokenInput.trim()}
                  onClick={() => {
                    saveToken(tokenInput.trim());
                    setTokenInput('');
                  }}
                >
                  Store token in browser
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
