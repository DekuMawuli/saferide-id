'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api/client';
import { fetchSimSmsOutbox, postSimSms, type SimSmsRow } from '@/lib/api/public-trust';
import { isApiConfigured } from '@/lib/api/config';
import { MessageSquare, RefreshCw } from 'lucide-react';

export default function SmsSimulatorPage() {
  const [rows, setRows] = useState<SimSmsRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [to, setTo] = useState('+255700000001');
  const [body, setBody] = useState('Hello from SafeRide sim');

  const load = useCallback(async () => {
    if (!isApiConfigured()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSimSmsOutbox(150);
      setRows(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sendTest = async () => {
    try {
      await postSimSms({ to_address: to, body, tag: 'manual' });
      setBody('');
      void load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Send failed');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      <main className="container mx-auto max-w-2xl flex-1 px-4 py-8">
        <div className="mb-6">
          <Link href="/verify" className="text-sm text-indigo-600 hover:underline">
            ← Back to verify
          </Link>
        </div>
        <Card className="mb-6 border-0 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
              Simulated SMS outbox
            </CardTitle>
            <CardDescription>
              <code className="text-xs">GET /public/simulate/sms</code> — no auth. Panic and USSD flows append rows
              here. Recipients for panic come from backend{' '}
              <code className="text-xs">SIM_EMERGENCY_SMS_RECIPIENTS</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>To</Label>
                <Input value={to} onChange={(e) => setTo(e.target.value)} className="font-mono text-sm" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Body</Label>
                <Input value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={() => void sendTest()}>
                Log outbound SMS (sim)
              </Button>
              <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardContent>
        </Card>
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">Recent messages (newest first)</h2>
          <ul className="space-y-2">
            {rows.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-medium text-indigo-800">{r.to}</span>
                  <span className="text-muted-foreground text-xs">{r.tag}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{r.body}</p>
                <p className="text-muted-foreground mt-1 text-xs">{r.created_at}</p>
              </li>
            ))}
          </ul>
          {rows.length === 0 && !loading ? (
            <p className="text-muted-foreground text-sm">No messages yet. Run USSD panic or set env recipients.</p>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
