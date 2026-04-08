'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Footer } from '@/components/shared/footer';
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
  ChevronLeft,
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

const KEY_LETTERS: Record<string, string> = {
  '1': '', '2': 'ABC', '3': 'DEF',
  '4': 'GHI', '5': 'JKL', '6': 'MNO',
  '7': 'PQRS', '8': 'TUV', '9': 'WXYZ',
  '0': '+', '*': '', '#': '',
};

/* ─── Reusable phone shell ─────────────────────────────────────────────── */
function PhoneShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative" style={{ width: 'min(100vw - 1.5rem, 430px)' }}>
      {/* side buttons — Pixel 9 Pro flat aluminium rails */}
      <div className="absolute -left-[6px] top-28 h-9 w-[7px] rounded-l"   style={{ background: 'linear-gradient(180deg,#3a3a3a,#222)' }} aria-hidden />
      <div className="absolute -left-[6px] top-44 h-20 w-[7px] rounded-l"  style={{ background: 'linear-gradient(180deg,#3a3a3a,#222)' }} aria-hidden />
      <div className="absolute -left-[6px] top-68 h-20 w-[7px] rounded-l"  style={{ background: 'linear-gradient(180deg,#3a3a3a,#222)' }} aria-hidden />
      <div className="absolute -right-[6px] top-48 h-28 w-[7px] rounded-r" style={{ background: 'linear-gradient(180deg,#3a3a3a,#222)' }} aria-hidden />

      {/* outer shell — Pixel 9 Pro uses a polished flat-edge frame */}
      <div
        className="overflow-hidden rounded-[2.2rem] p-[4px]"
        style={{
          background: 'linear-gradient(145deg,#2e2e2e 0%,#181818 55%,#0c0c0c 100%)',
          boxShadow:
            '0 50px 110px rgba(0,0,0,0.98), 0 0 0 1px rgba(255,255,255,0.07), inset 0 1px 0 rgba(255,255,255,0.09)',
        }}
      >
        <div className="overflow-hidden rounded-[1.9rem] bg-black">
          {/* scanlines */}
          <div
            className="pointer-events-none absolute inset-0 z-20 opacity-[0.018]"
            style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent,transparent 2px,#000 2px,#000 4px)' }}
          />
          {/* glass reflection */}
          <div
            className="pointer-events-none absolute left-[6%] right-[38%] top-0 z-30 h-[38%] rounded-b-full opacity-[0.035]"
            style={{ background: 'linear-gradient(180deg,rgba(255,255,255,0.9) 0%,transparent 100%)' }}
          />

          {/* Pixel 9 Pro pill notch — slightly wider */}
          <div className="relative z-30 flex justify-center pt-4 pb-1">
            <div className="h-[26px] w-[116px] rounded-full bg-black" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04)' }} />
          </div>

          {/* status bar */}
          <div className="relative z-10 flex items-center justify-between px-7 pb-1.5 pt-0.5">
            <span className="font-mono text-[12px] font-semibold text-zinc-300">9:41</span>
            <div className="flex items-center gap-2 text-zinc-300">
              <Signal className="h-3.5 w-3.5" />
              <Wifi className="h-3.5 w-3.5" />
              <Battery className="h-4 w-4" />
            </div>
          </div>

          {children}

          {/* home bar */}
          <div className="relative z-10 flex justify-center pb-4 pt-2" style={{ background: '#040905' }}>
            <div className="h-1 w-32 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────────────── */
export default function UssdSimulatorPage() {
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

  const [phonePane, setPhonePane] = useState<'ussd' | 'messages'>('ussd');
  const [smsRows, setSmsRows] = useState<SimSmsRow[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  const showScreen = useCallback((text: string) => {
    setLines([`« ${text}`]);
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

  const proceedToSimulator = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPhoneStepError(null);
    const n = phoneDraft.trim();
    if (!n) { setPhoneStepError('Enter a phone number to continue.'); return; }
    if (n.length < 8) { setPhoneStepError('Use a full MSISDN (e.g. +255700123456).'); return; }
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

  const send = async (
    text: string,
    opts?: { sessionIdOverride?: string | null; resetTranscript?: boolean },
  ) => {
    if (!isApiConfigured()) { setError('Set NEXT_PUBLIC_API_URL'); return; }
    setLoading(true);
    setError(null);
    if (opts?.resetTranscript) setLines([]);
    try {
      const res: UssdSimResponse = await postUssdSimTurn({
        msisdn,
        session_id: opts?.sessionIdOverride !== undefined ? opts.sessionIdOverride : sessionId,
        input: text,
      });
      setSessionId(res.continue_session ? res.session_id : null);
      showScreen(stripConEnd(res.message));
      setInput('');
      if (!res.continue_session) {
        setSessionId(null);
        // Session ended — refresh SMS inbox in case a consent response SMS was just sent
        void loadInbox();
      }
      if (phonePane === 'messages') void loadInbox();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const startSession = () => {
    setSessionId(null);
    setInput('');
    setError(null);
    void send('', { sessionIdOverride: null, resetTranscript: true });
  };

  const clearAll = () => { setLines([]); setSessionId(null); setInput(''); setError(null); };
  const appendKey = (k: string) => setInput((prev) => prev + k);
  const backspace = () => setInput((prev) => prev.slice(0, -1));

  /* ─── Page wrapper ───────────────────────────────────────────────────── */
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        backgroundColor: '#04090600',
        backgroundImage: [
          'radial-gradient(ellipse 80% 55% at 65% 40%, rgba(16,185,129,0.10) 0%, transparent 65%)',
          'radial-gradient(ellipse 50% 40% at 20% 70%, rgba(16,185,129,0.06) 0%, transparent 60%)',
          'linear-gradient(180deg, #040a06 0%, #060e09 100%)',
        ].join(','),
      }}
    >
      {/* subtle dot-grid overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(16,185,129,0.12) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          maskImage: 'radial-gradient(ellipse 85% 85% at 60% 45%, black 20%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 85% 85% at 60% 45%, black 20%, transparent 75%)',
        }}
      />
      {/* top bar */}
      <div className="flex items-center justify-between border-b border-zinc-800/50 px-5 py-3" style={{ background: 'rgba(6,12,9,0.95)' }}>
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" style={{ boxShadow: '0 0 5px rgba(16,185,129,0.9)' }} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">USSD Simulator</span>
        </div>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl border border-zinc-700/50 bg-zinc-900/80 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition hover:border-emerald-800/60 hover:bg-zinc-800 hover:text-emerald-400"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Go Home
        </Link>
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-10 px-4 py-10 md:flex-row md:items-start md:py-16">

        {/* ── phone-number step ─────────────────────────────────────────── */}
        {step === 'phone' && (
          <div className="relative flex flex-col items-center">
            {/* glow under phone */}
            <div
              className="pointer-events-none absolute -bottom-8 left-1/2 h-28 w-60 -translate-x-1/2 rounded-full opacity-40"
              style={{ background: 'radial-gradient(ellipse,rgba(16,185,129,0.4) 0%,transparent 70%)', filter: 'blur(22px)' }}
            />

            <PhoneShell>
              {/* screen content */}
              <div className="relative z-10 flex flex-col" style={{ background: '#000', minHeight: 820 }}>

                {/* SIM icon + heading */}
                <div className="flex flex-col items-center px-6 pb-4 pt-8">
                  <div
                    className="mb-5 flex h-20 w-16 flex-col items-center justify-center rounded-2xl border border-emerald-900/40"
                    style={{
                      background: 'linear-gradient(145deg,#0d2218,#091710)',
                      boxShadow: '0 0 28px rgba(16,185,129,0.13), inset 0 1px 0 rgba(16,185,129,0.08)',
                    }}
                  >
                    <span
                      className="font-mono text-lg font-black tracking-widest text-emerald-400"
                      style={{ textShadow: '0 0 10px rgba(16,185,129,0.7)' }}
                    >
                      SIM
                    </span>
                    <div className="mt-1 h-px w-8" style={{ background: 'rgba(16,185,129,0.35)' }} />
                  </div>
                  <p className="font-mono text-base font-bold text-white">Enter your number</p>
                  <p className="mt-1.5 text-center font-mono text-[11px] text-zinc-500">
                    Simulates <span className="text-emerald-700">*384*SAFERIDE#</span>
                  </p>
                </div>

                {/* divider */}
                <div className="mx-5 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.15),transparent)' }} />

                {/* form */}
                <form onSubmit={proceedToSimulator} className="flex flex-1 flex-col px-5 pt-6 pb-4 gap-4">
                  <div>
                    <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-600">
                      MSISDN
                    </p>
                    <input
                      value={phoneDraft}
                      onChange={(e) => { setPhoneDraft(e.target.value); setPhoneStepError(null); }}
                      className="w-full rounded-2xl border border-zinc-800/60 bg-zinc-950/80 px-4 py-4 text-center font-mono text-xl text-emerald-300 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-800/60"
                      style={{ caretColor: '#10b981', textShadow: '0 0 10px rgba(16,185,129,0.35)' }}
                      placeholder="+255700123456"
                      autoComplete="tel"
                      inputMode="tel"
                      autoFocus
                    />
                    {phoneStepError && (
                      <p className="mt-2 text-center font-mono text-xs text-red-400">{phoneStepError}</p>
                    )}
                    {!isApiConfigured() && (
                      <p className="mt-2 text-center font-mono text-[10px] text-amber-500/80">⚠ Set NEXT_PUBLIC_API_URL</p>
                    )}
                  </div>

                  <div className="mt-auto space-y-2.5">
                    <button
                      type="submit"
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-mono text-sm font-bold uppercase tracking-widest text-black transition-all hover:brightness-110 active:scale-[0.98]"
                      style={{
                        background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)',
                        boxShadow: '0 0 28px rgba(16,185,129,0.28)',
                      }}
                    >
                      CONNECT
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
                    <p className="text-center font-mono text-[9px] text-zinc-700">
                      MSISDN sent on every USSD turn · panic SMS · consent
                    </p>
                  </div>
                </form>
              </div>
            </PhoneShell>
          </div>
        )}

        {/* ── simulator step ─────────────────────────────────────────────── */}
        {step === 'simulator' && (
          <>
            {/* left panel */}
            <aside className="relative z-10 w-full max-w-[210px] shrink-0 md:sticky md:top-10">

              {/* Change Number — prominent button */}
              <button
                type="button"
                onClick={changeNumber}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-700/40 py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-emerald-400 transition hover:border-emerald-500/60 hover:bg-emerald-950/40 hover:text-emerald-300 active:scale-[0.97]"
                style={{ background: 'rgba(16,185,129,0.06)', boxShadow: '0 0 20px rgba(16,185,129,0.08)' }}
              >
                <ChevronLeft className="h-4 w-4" />
                Change Number
              </button>

              {/* info card */}
              <div
                className="overflow-hidden rounded-2xl border border-zinc-700/60"
                style={{
                  background: 'linear-gradient(160deg,#111a14 0%,#0c1410 100%)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                {/* header */}
                <div className="border-b border-zinc-700/40 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">SESSION</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px rgba(16,185,129,1)' }} />
                  </div>
                </div>

                <div className="border-b border-zinc-700/40 px-4 py-3">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">SUBSCRIBER</p>
                  <p className="break-all font-mono text-xs font-semibold text-emerald-300" style={{ textShadow: '0 0 8px rgba(16,185,129,0.5)' }}>{msisdn}</p>
                </div>

                <div className="border-b border-zinc-700/40 px-4 py-3">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-widest text-zinc-500">SERVICE</p>
                  <p className="font-mono text-xs text-emerald-400">*384*SAFERIDE#</p>
                </div>

                <div className="px-4 py-4">
                  <p className="mb-3 font-mono text-[9px] uppercase tracking-widest text-zinc-500">MENU</p>
                  <div className="space-y-3">
                    {[
                      { key: '1', label: 'Verify driver' },
                      { key: '2', label: 'Panic share' },
                      { key: '3', label: 'Ext. disclosure' },
                      { key: '0', label: 'Exit' },
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold text-emerald-400"
                          style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}
                        >
                          {key}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-300">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-zinc-700/40 px-4 py-3">
                  <p className="text-center font-mono text-[9px] text-zinc-600">POST /public/simulate/ussd</p>
                </div>
              </div>
            </aside>

            {/* phone */}
            <div className="relative flex shrink-0 flex-col items-center">
              {/* glow pool */}
              <div
                className="pointer-events-none absolute -bottom-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full opacity-40"
                style={{ background: 'radial-gradient(ellipse,rgba(16,185,129,0.38) 0%,transparent 70%)', filter: 'blur(24px)' }}
              />

              <PhoneShell>
                <div className="relative z-10 flex flex-col" style={{ background: '#000' }}>

                  {/* subscriber header */}
                  <div className="border-b border-zinc-900 px-5 py-3" style={{ background: 'rgba(3,8,5,0.97)' }}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-zinc-600">SAFERIDE</p>
                        <p
                          className="max-w-[165px] truncate font-mono text-[12px] font-semibold text-emerald-400"
                          style={{ textShadow: '0 0 6px rgba(16,185,129,0.5)' }}
                        >{msisdn}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-[8px] text-emerald-800">*384*SAFERIDE#</p>
                        <div className="mt-0.5 flex items-center justify-end gap-1">
                          <div
                            className={`h-1.5 w-1.5 rounded-full transition-colors ${sessionId ? 'bg-emerald-400' : 'bg-zinc-700'}`}
                            style={sessionId ? { boxShadow: '0 0 5px rgba(16,185,129,0.9)' } : {}}
                          />
                          <span className="font-mono text-[8px] text-zinc-600">{sessionId ? 'ACTIVE' : 'IDLE'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* tab bar */}
                  <div className="flex gap-1 border-b border-zinc-900 px-2 py-2" style={{ background: 'rgba(3,8,5,0.97)' }}>
                    {(['ussd', 'messages'] as const).map((pane) => (
                      <button
                        key={pane}
                        type="button"
                        onClick={() => setPhonePane(pane)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 font-mono text-[11px] font-bold uppercase tracking-widest transition-all"
                        style={
                          phonePane === pane
                            ? { background: 'rgba(16,185,129,0.1)', color: '#6ee7b7', textShadow: '0 0 8px rgba(16,185,129,0.6)' }
                            : { color: '#52525b' }
                        }
                      >
                        {pane === 'messages' && <MessageSquare className="h-3.5 w-3.5" />}
                        {pane === 'ussd' ? 'USSD' : 'SMS'}
                      </button>
                    ))}
                  </div>

                  {/* ── USSD pane ─────────────────────────── */}
                  {phonePane === 'ussd' ? (
                    <>
                      <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto px-5 py-4"
                        style={{ background: '#000', minHeight: 220 }}
                      >
                        {lines.length === 0 ? (
                          <div className="flex h-full flex-col items-center justify-center gap-2 py-8">
                            <p className="font-mono text-[12px] text-zinc-700">
                              Press <span className="text-emerald-700">DIAL</span> to start session
                            </p>
                            <p className="font-mono text-[10px] text-zinc-800">*384*SAFERIDE#</p>
                          </div>
                        ) : (
                          lines.map((l, i) => (
                            <div
                              key={i}
                              className="mb-1 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-emerald-400"
                              style={{ textShadow: '0 0 8px rgba(16,185,129,0.6)' }}
                            >{l}</div>
                          ))
                        )}
                        {loading && (
                          <span
                            className="animate-pulse font-mono text-base text-emerald-500"
                            style={{ textShadow: '0 0 6px rgba(16,185,129,0.5)' }}
                          >▌</span>
                        )}
                      </div>

                      {error && (
                        <div className="mx-4 mb-2 rounded-xl border border-red-900/30 bg-red-950/20 px-3 py-2 font-mono text-[10px] text-red-400">
                          {error}
                        </div>
                      )}

                      {/* action row */}
                      <div className="flex gap-2.5 px-4 pb-2.5 pt-2" style={{ background: '#040905' }}>
                        <button
                          type="button"
                          onClick={startSession}
                          disabled={loading}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl py-3 font-mono text-[12px] font-bold uppercase tracking-widest text-black transition hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)', boxShadow: '0 0 16px rgba(16,185,129,0.28)' }}
                        >
                          <PhoneCall className="h-4 w-4" /> DIAL
                        </button>
                        <button
                          type="button"
                          onClick={clearAll}
                          disabled={loading}
                          className="flex items-center gap-2 rounded-2xl border border-zinc-700/50 bg-zinc-900/80 px-5 py-3 font-mono text-[12px] font-bold uppercase tracking-widest text-zinc-300 transition hover:bg-zinc-800 active:scale-[0.97] disabled:opacity-40"
                        >
                          <RotateCcw className="h-4 w-4" /> CLR
                        </button>
                      </div>

                      {/* response input */}
                      <form
                        className="flex gap-2 px-4 pb-2.5"
                        style={{ background: '#040905' }}
                        onSubmit={(e) => { e.preventDefault(); void send(input); }}
                      >
                        <input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder="Response…"
                          disabled={loading}
                          className="flex-1 rounded-2xl border border-zinc-700/40 bg-black/80 px-4 py-3 font-mono text-sm text-emerald-300 placeholder:text-zinc-700 focus:outline-none focus:ring-1 focus:ring-emerald-800/60 disabled:opacity-40"
                          style={{ caretColor: '#10b981' }}
                        />
                        <button
                          type="submit"
                          disabled={loading}
                          className="rounded-2xl px-5 font-mono text-[12px] font-bold uppercase tracking-wider text-black transition hover:brightness-110 disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#10b981 0%,#059669 100%)' }}
                        >
                          OK
                        </button>
                      </form>

                      <div className="mx-4 mb-3 h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(16,185,129,0.12),transparent)' }} />

                      {/* keypad */}
                      <div className="px-4 pb-1" style={{ background: '#040905' }}>
                        <div className="mb-2 flex justify-end">
                          <button
                            type="button"
                            onClick={backspace}
                            className="flex items-center gap-1 rounded-xl px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-600 transition hover:bg-zinc-900 hover:text-zinc-300"
                          >
                            <Delete className="h-3.5 w-3.5" /> DEL
                          </button>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5">
                          {KEYPAD_KEYS.flat().map((key) => (
                            <button
                              key={key}
                              type="button"
                              disabled={loading}
                              onClick={() => appendKey(key)}
                              className="flex flex-col items-center justify-center rounded-2xl py-3.5 transition-all active:scale-95 active:brightness-90 disabled:opacity-30"
                              style={{
                                background: 'linear-gradient(160deg,#1d241f 0%,#101610 100%)',
                                boxShadow: '0 5px 0 #050906, 0 6px 12px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)',
                              }}
                            >
                              <span className="font-mono text-2xl font-bold leading-none text-zinc-100">{key}</span>
                              {KEY_LETTERS[key] ? (
                                <span className="mt-1 font-mono text-[8px] font-semibold tracking-widest text-zinc-600">
                                  {KEY_LETTERS[key]}
                                </span>
                              ) : <span className="mt-1 h-[11px]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* ── Messages pane ─────────────────── */
                    <>
                      <div className="flex flex-1 flex-col" style={{ background: '#000', minHeight: 560 }}>
                        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-2.5">
                          <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-zinc-600">INBOX</span>
                          <button
                            type="button"
                            onClick={() => void loadInbox()}
                            disabled={smsLoading}
                            className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/70 px-2.5 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest text-emerald-500 transition hover:bg-zinc-800 disabled:opacity-50"
                          >
                            <RefreshCw className={`h-3 w-3 ${smsLoading ? 'animate-spin' : ''}`} />
                            SYNC
                          </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                          {!isApiConfigured() ? (
                            <p className="text-center font-mono text-[10px] text-amber-500/80">⚠ Set NEXT_PUBLIC_API_URL</p>
                          ) : smsError ? (
                            <p className="text-center font-mono text-[10px] text-red-400">{smsError}</p>
                          ) : smsLoading && smsRows.length === 0 ? (
                            <p className="animate-pulse text-center font-mono text-[10px] text-zinc-600">LOADING…</p>
                          ) : smsRows.length === 0 ? (
                            <div className="flex flex-col items-center gap-3 py-10">
                              <MessageSquare className="h-10 w-10 text-zinc-800" />
                              <p className="text-center font-mono text-[11px] leading-relaxed text-zinc-600">
                                No messages yet.<br />Run verify (1) or consent (3).
                              </p>
                            </div>
                          ) : (
                            smsRows.map((r) => (
                              <div
                                key={r.id}
                                className="rounded-2xl border border-zinc-900 px-4 py-3"
                                style={{ background: 'rgba(16,185,129,0.03)' }}
                              >
                                <div className="mb-1.5 flex items-center justify-between gap-1">
                                  <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-emerald-700">{r.tag}</span>
                                  <span className="max-w-[110px] truncate font-mono text-[8px] text-zinc-700">{r.created_at}</span>
                                </div>
                                <p className="whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-zinc-300">{r.body}</p>
                              </div>
                            ))
                          )}
                        </div>

                        <div className="border-t border-zinc-900 px-5 py-2">
                          <p className="text-center font-mono text-[8px] text-zinc-700">to: {msisdn}</p>
                        </div>
                      </div>

                      {/* ghost keypad */}
                      <div className="px-4 pb-1 pt-3" style={{ background: '#040905' }}>
                        <div className="grid grid-cols-3 gap-2.5">
                          {KEYPAD_KEYS.flat().map((key) => (
                            <div
                              key={key}
                              className="flex flex-col items-center justify-center rounded-2xl py-3.5 opacity-[0.12]"
                              style={{
                                background: 'linear-gradient(160deg,#1d241f 0%,#101610 100%)',
                                boxShadow: '0 5px 0 #050906, inset 0 1px 0 rgba(255,255,255,0.05)',
                              }}
                            >
                              <span className="font-mono text-2xl font-bold leading-none text-zinc-100">{key}</span>
                              {KEY_LETTERS[key] && (
                                <span className="mt-1 font-mono text-[8px] tracking-widest text-zinc-600">{KEY_LETTERS[key]}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </PhoneShell>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
