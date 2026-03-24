'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError } from '@/lib/api/client';
import {
  fetchSimSmsOutbox,
  postUssdSimTurn,
  type SimSmsRow,
  type UssdSimResponse,
} from '@/lib/api/public-trust';
import { isApiConfigured } from '@/lib/api/config';
import {
  ArrowRight,
  Delete,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  RotateCcw,
  Signal,
  Wifi,
  Battery,
} from 'lucide-react';

function stripConEnd(msg: string) {
  if (msg.startsWith('CON ')) return msg.slice(4);
  if (msg.startsWith('END ')) return msg.slice(4);
  return msg;
}

const KEYPAD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
] as const;

export default function UssdSimulatorPage() {
  /** Africa's Talking flow: collect phone number first, then open the device simulator. */
  const [step, setStep] = useState<'phone' | 'simulator'>('phone');
  const [phoneDraft, setPhoneDraft] = useState('+255700123456');
  const [msisdn, setMsisdn] = useState('');
  const [phoneStepError, setPhoneStepError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [lines, setLines] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** In-handset inbox: SMS rows where `to` matches this subscriber (USSD verify, consent, etc.). */
  const [phonePane, setPhonePane] = useState<'ussd' | 'messages'>('ussd');
  const [smsRows, setSmsRows] = useState<SimSmsRow[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  const append = useCallback((role: 'you' | 'net', text: string) => {
    const prefix = role === 'you' ? '› ' : '« ';
    setLines((prev) => [...prev, `${prefix}${text}`]);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, loading]);

  const loadInbox = useCallback(async () => {
    if (!isApiConfigured() || !msisdn) return;
    setSmsLoading(true);
    setSmsError(null);
    try {
      const data = await fetchSimSmsOutbox(100, { to: msisdn });
      setSmsRows(data);
    } catch (e) {
      setSmsError(e instanceof ApiError ? e.message : 'Failed to load messages');
    } finally {
      setSmsLoading(false);
    }
  }, [msisdn]);

  useEffect(() => {
    if (step !== 'simulator' || phonePane !== 'messages') return;
    void loadInbox();
  }, [step, phonePane, loadInbox]);

  const proceedToSimulator = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneStepError(null);
    const n = phoneDraft.trim();
    if (!n) {
      setPhoneStepError('Enter a phone number to continue.');
      return;
    }
    if (n.length < 8) {
      setPhoneStepError('Use a full MSISDN (e.g. +255700123456).');
      return;
    }
    setMsisdn(n);
    setSessionId(null);
    setLines([]);
    setInput('');
    setError(null);
    setPhonePane('ussd');
    setSmsRows([]);
    setSmsError(null);
    setStep('simulator');
  };

  const changeNumber = () => {
    setPhoneDraft(msisdn || phoneDraft);
    setSessionId(null);
    setLines([]);
    setInput('');
    setError(null);
    setStep('phone');
  };

  const send = async (text: string) => {
    if (!isApiConfigured()) {
      setError('Set NEXT_PUBLIC_API_URL');
      return;
    }
    setLoading(true);
    setError(null);
    if (text.trim()) append('you', text.trim());
    try {
      const res: UssdSimResponse = await postUssdSimTurn({
        msisdn,
        session_id: sessionId,
        input: text,
      });
      setSessionId(res.continue_session ? res.session_id : null);
      append('net', stripConEnd(res.message));
      setInput('');
      if (!res.continue_session) {
        setSessionId(null);
      }
      if (phonePane === 'messages') void loadInbox();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const startSession = () => void send('');
  const clearAll = () => {
    setLines([]);
    setSessionId(null);
    setInput('');
    setError(null);
  };

  const appendKey = (k: string) => setInput((prev) => prev + k);
  const backspace = () => setInput((prev) => prev.slice(0, -1));

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-300">
      <Navbar />

      {step === 'phone' ? (
        <main className="container mx-auto flex flex-1 flex-col items-center justify-center px-4 py-12">
          <Link href="/verify" className="mb-6 self-start text-sm font-medium text-slate-600 hover:text-indigo-700 sm:self-center">
            ← Back to verify
          </Link>
          <Card className="w-full max-w-md border-slate-200/80 shadow-xl">
            <CardHeader className="space-y-1 text-center">
              <CardTitle className="text-2xl font-bold text-slate-900">USSD simulator</CardTitle>
              <CardDescription className="text-base text-slate-600">
                Enter the subscriber phone number first — same flow as Africa&apos;s Talking — then you&apos;ll open the
                handset session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={proceedToSimulator} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="at-phone" className="text-slate-800">
                    Phone number
                  </Label>
                  <Input
                    id="at-phone"
                    value={phoneDraft}
                    onChange={(e) => {
                      setPhoneDraft(e.target.value);
                      setPhoneStepError(null);
                    }}
                    className="h-12 font-mono text-lg"
                    placeholder="+255700123456"
                    autoComplete="tel"
                    inputMode="tel"
                    autoFocus
                  />
                  <p className="text-muted-foreground text-xs">
                    This MSISDN is sent as <code className="rounded bg-slate-100 px-1">msisdn</code> on every USSD turn
                    (panic SMS, consent SMS, etc.).
                  </p>
                </div>
                {phoneStepError ? <p className="text-sm text-red-600">{phoneStepError}</p> : null}
                {!isApiConfigured() ? (
                  <p className="text-sm text-amber-800">Set NEXT_PUBLIC_API_URL in the web app env.</p>
                ) : null}
                <Button type="submit" className="h-11 w-full bg-indigo-600 text-base hover:bg-indigo-700" size="lg">
                  Create session
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
              <p className="text-muted-foreground mt-6 text-center text-xs">
                After this step you&apos;ll see the phone mockup, service code <span className="font-mono">*384*SAFERIDE#</span>
                , and keypad.
              </p>
            </CardContent>
          </Card>
        </main>
      ) : (
        <main className="container mx-auto flex flex-1 flex-col items-center px-4 py-8 md:flex-row md:items-start md:justify-center md:gap-12 md:py-12">
          <div className="mb-6 w-full max-w-sm md:mb-0 md:max-w-xs">
            <button
              type="button"
              onClick={changeNumber}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              ← Change phone number
            </button>
            <p className="mt-2 font-mono text-sm text-slate-800">
              Subscriber: <span className="font-semibold text-indigo-900">{msisdn}</span>
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900">USSD session</h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Payload:{' '}
              <code className="rounded bg-white/80 px-1 py-0.5 text-xs shadow-sm">POST /public/simulate/ussd</code>.
              Simulated SMS:{' '}
              <Link href="/simulate/sms" className="font-medium text-indigo-700 underline">
                outbox
              </Link>
              .
            </p>
            <ul className="mt-4 list-inside list-disc space-y-1 text-xs text-slate-500">
              <li>
                <strong>1</strong> — verify driver (short code)
              </li>
              <li>
                <strong>2</strong> — panic share
              </li>
              <li>
                <strong>3</strong> — extended disclosure request
              </li>
              <li>
                <strong>0</strong> — exit
              </li>
            </ul>
          </div>

          <div className="relative shrink-0">
            <div
              className="relative rounded-[2.75rem] border-[14px] border-zinc-800 bg-zinc-800 p-1 shadow-[0_25px_80px_-12px_rgba(0,0,0,0.55),inset_0_2px_0_rgba(255,255,255,0.06)]"
              style={{ width: 'min(100vw - 2rem, 320px)' }}
            >
              <div className="absolute -left-[3px] top-24 h-14 w-1 rounded-l bg-zinc-700" aria-hidden />
              <div className="absolute -left-[3px] top-44 h-20 w-1 rounded-l bg-zinc-700" aria-hidden />
              <div className="absolute -right-[3px] top-36 h-24 w-1 rounded-r bg-zinc-700" aria-hidden />

              <div className="overflow-hidden rounded-[2.1rem] bg-black ring-1 ring-white/10">
                <div className="relative flex h-7 items-center justify-center bg-zinc-950 pt-1">
                  <div className="h-5 w-[88px] rounded-full bg-black ring-1 ring-zinc-800" />
                </div>

                <div className="flex min-h-[520px] flex-col bg-zinc-950">
                  <div className="flex items-center justify-between px-4 pb-1 pt-0.5 text-[10px] font-medium text-zinc-500">
                    <span>9:41</span>
                    <div className="flex items-center gap-1.5">
                      <Signal className="h-3 w-3" />
                      <Wifi className="h-3 w-3" />
                      <Battery className="h-3 w-3" />
                    </div>
                  </div>

                  <div className="border-b border-zinc-800/80 bg-zinc-900/90 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500">Subscriber</p>
                    <p className="truncate font-mono text-xs font-medium text-emerald-400">{msisdn}</p>
                    <p className="mt-1 font-mono text-[10px] text-emerald-600/90">*384*SAFERIDE#</p>
                  </div>

                  <div className="flex border-b border-zinc-800/80 bg-zinc-950 px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => setPhonePane('ussd')}
                      className={`flex-1 rounded-md py-1.5 text-[11px] font-semibold transition ${
                        phonePane === 'ussd'
                          ? 'bg-emerald-900/80 text-emerald-100'
                          : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                      }`}
                    >
                      USSD
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhonePane('messages')}
                      className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-semibold transition ${
                        phonePane === 'messages'
                          ? 'bg-emerald-900/80 text-emerald-100'
                          : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300'
                      }`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Messages
                    </button>
                  </div>

                  {phonePane === 'ussd' ? (
                    <>
                      <div
                        ref={scrollRef}
                        className="min-h-[200px] flex-1 overflow-y-auto px-3 py-2 font-mono text-[13px] leading-snug"
                      >
                        {lines.length === 0 ? (
                          <p className="text-center text-sm text-zinc-600">
                            Tap <span className="text-emerald-500">Dial</span> to open a session.
                          </p>
                        ) : (
                          lines.map((l, i) => (
                            <div
                              key={i}
                              className={`mb-2 whitespace-pre-wrap ${
                                l.startsWith('›') ? 'text-amber-200/90' : 'text-emerald-400'
                              }`}
                            >
                              {l}
                            </div>
                          ))
                        )}
                        {loading ? <div className="animate-pulse text-emerald-500/70">…</div> : null}
                      </div>

                      {error ? (
                        <div className="mx-2 mb-2 rounded border border-red-900/60 bg-red-950/50 px-2 py-1.5 text-[11px] text-red-300">
                          {error}
                        </div>
                      ) : null}

                      <div className="border-t border-zinc-800 bg-zinc-900/95 px-2 pb-2 pt-2">
                        <div className="mb-2 flex gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            className="h-8 flex-1 bg-emerald-700 text-xs font-semibold text-white hover:bg-emerald-600"
                            onClick={startSession}
                            disabled={loading}
                          >
                            <PhoneCall className="mr-1 h-3.5 w-3.5" />
                            Dial
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 border-zinc-600 bg-zinc-800/80 text-xs text-zinc-200 hover:bg-zinc-700"
                            onClick={clearAll}
                            disabled={loading}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            New
                          </Button>
                        </div>
                        <form
                          className="flex gap-1.5"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void send(input);
                          }}
                        >
                          <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Response…"
                            className="h-9 flex-1 border-zinc-700 bg-black font-mono text-sm text-emerald-300 placeholder:text-zinc-600 focus-visible:ring-emerald-500/40"
                            disabled={loading}
                          />
                          <Button
                            type="submit"
                            size="sm"
                            className="h-9 shrink-0 bg-emerald-600 px-3 text-xs font-semibold hover:bg-emerald-500"
                            disabled={loading}
                          >
                            Send
                          </Button>
                        </form>
                      </div>

                      <div className="border-t border-zinc-800 bg-black px-2 pb-4 pt-2">
                        <div className="mb-1 flex justify-end">
                          <button
                            type="button"
                            onClick={backspace}
                            className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
                          >
                            <Delete className="h-3 w-3" />
                            Clear
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {KEYPAD_KEYS.flat().map((key) => (
                            <button
                              key={key}
                              type="button"
                              disabled={loading}
                              onClick={() => appendKey(key)}
                              className="flex h-11 items-center justify-center rounded-xl bg-zinc-900 font-mono text-lg font-medium text-zinc-100 shadow-[inset_0_-2px_0_rgba(0,0,0,0.4)] ring-1 ring-zinc-700/80 transition hover:bg-zinc-800 active:translate-y-px disabled:opacity-40"
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex min-h-[280px] flex-1 flex-col overflow-hidden">
                        <div className="flex items-center justify-between border-b border-zinc-800/80 px-2 py-1.5">
                          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                            Inbox (sim)
                          </span>
                          <button
                            type="button"
                            onClick={() => void loadInbox()}
                            disabled={smsLoading}
                            className="flex items-center gap-1 rounded-md bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-zinc-700 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${smsLoading ? 'animate-spin' : ''}`} />
                            Fetch
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto px-2 py-2">
                          {!isApiConfigured() ? (
                            <p className="text-center text-xs text-amber-400/90">Set NEXT_PUBLIC_API_URL</p>
                          ) : smsError ? (
                            <p className="text-center text-xs text-red-400">{smsError}</p>
                          ) : smsLoading && smsRows.length === 0 ? (
                            <p className="text-center text-xs text-zinc-500">Loading…</p>
                          ) : smsRows.length === 0 ? (
                            <p className="text-center text-[11px] leading-relaxed text-zinc-500">
                              No SMS to this number yet. Run verify (1) or consent (3) in USSD — or use the{' '}
                              <Link href="/simulate/sms" className="text-emerald-500 underline">
                                SMS lab
                              </Link>
                              .
                            </p>
                          ) : (
                            <ul className="space-y-2">
                              {smsRows.map((r) => (
                                <li
                                  key={r.id}
                                  className="rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-1.5 text-[11px]"
                                >
                                  <div className="flex items-center justify-between gap-1 text-[10px] text-zinc-500">
                                    <span className="font-mono text-emerald-600/90">{r.tag}</span>
                                    <span className="truncate">{r.created_at}</span>
                                  </div>
                                  <p className="mt-1 whitespace-pre-wrap text-zinc-200">{r.body}</p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <p className="border-t border-zinc-800/80 px-2 py-1.5 text-[9px] leading-snug text-zinc-600">
                          Filter: <span className="font-mono text-zinc-500">to={msisdn}</span>. Panic SMS go to env
                          recipients, not this inbox.
                        </p>
                      </div>
                      <div className="border-t border-zinc-800 bg-black px-2 pb-4 pt-2" aria-hidden />
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-center pb-1 pt-1">
                <div className="h-1 w-28 rounded-full bg-zinc-600" />
              </div>
            </div>
          </div>
        </main>
      )}

      <Footer />
    </div>
  );
}
