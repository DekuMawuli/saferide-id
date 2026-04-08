'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'motion/react';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  QrCode,
  UserCheck,
  AlertTriangle,
  Smartphone,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Fingerprint,
  Bell,
} from 'lucide-react';

// ─── data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '3 sec', label: 'Average verification time' },
  { value: 'Zero', label: 'App downloads required' },
  { value: '3 tiers', label: 'Consent-based disclosure' },
  { value: 'USSD', label: 'Works on feature phones' },
];

const STEPS = [
  {
    num: '01',
    icon: QrCode,
    title: 'Scan or enter code',
    body: "Ask the driver for their short code or scan the QR on their vest or vehicle. Works from any browser — no account, no download.",
    color: 'bg-indigo-100 text-indigo-600',
    border: 'border-indigo-200',
  },
  {
    num: '02',
    icon: UserCheck,
    title: 'Check their identity',
    body: 'See the driver\'s government-verified name, photo, and current operating status instantly. Backed by eSignet national ID.',
    color: 'bg-emerald-100 text-emerald-600',
    border: 'border-emerald-200',
  },
  {
    num: '03',
    icon: Bell,
    title: 'Request more details',
    body: 'Need phone or verified ID? Send a consent request. The driver approves in their app — only then is extra data shared.',
    color: 'bg-violet-100 text-violet-600',
    border: 'border-violet-200',
  },
  {
    num: '04',
    icon: AlertTriangle,
    title: 'Ride safely or report',
    body: "Board with confidence knowing your driver is registered. Something wrong? File a report or trigger an emergency share in one tap.",
    color: 'bg-amber-100 text-amber-600',
    border: 'border-amber-200',
  },
];

const TRUST_BANDS = [
  {
    band: 'CLEAR',
    icon: CheckCircle2,
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    icon_color: 'text-emerald-600',
    badge: 'bg-emerald-500 text-white',
    desc: 'Driver is registered, verified, and cleared to operate. Safe to board.',
  },
  {
    band: 'CAUTION',
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon_color: 'text-amber-500',
    badge: 'bg-amber-400 text-white',
    desc: 'Account exists but has compliance flags. Proceed with care.',
  },
  {
    band: 'BLOCK',
    icon: XCircle,
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon_color: 'text-red-600',
    badge: 'bg-red-500 text-white',
    desc: 'Driver is suspended or flagged. Do not board this vehicle.',
  },
];

const CHANNELS = [
  {
    icon: Smartphone,
    title: 'Web / QR',
    desc: 'Scan a QR code or go to saferide.app/verify on any smartphone browser. Full photo, name, and vehicle details.',
    accent: 'text-indigo-600',
    ring: 'ring-indigo-200',
    bg: 'bg-indigo-50',
  },
  {
    icon: Phone,
    title: 'USSD *384#',
    desc: "No internet? Dial from any feature phone. Get the driver's name and trust status over USSD in seconds.",
    accent: 'text-emerald-600',
    ring: 'ring-emerald-200',
    bg: 'bg-emerald-50',
  },
  {
    icon: MessageSquare,
    title: 'SMS',
    desc: 'Text the short code to our number and receive a verification summary by return SMS. Works on any handset.',
    accent: 'text-violet-600',
    ring: 'ring-violet-200',
    bg: 'bg-violet-50',
  },
];

const spring = { type: 'spring', stiffness: 260, damping: 28 } as const;

/** Cubic bezier for duration-based tweens (underline draw, phone enter, badges). */
const easeOut = [0.22, 1, 0.36, 1] as const;

const staggerParent = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.06 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
};

const scrollParent = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.04 },
  },
};

const scrollItem = {
  hidden: { opacity: 0, y: 22 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
};

const scrollTitle = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: spring,
  },
};

const viewportOnce = { once: true, margin: '-60px' as const };

// ─── page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-indigo-950 text-white">
        {/* grid texture */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* glow blobs */}
        <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600 opacity-20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-emerald-500 opacity-15 blur-3xl" />

        <div className="container relative mx-auto max-w-6xl px-4 py-20 md:py-32">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* left copy */}
            <motion.div
              className="space-y-8"
              variants={staggerParent}
              initial="hidden"
              animate="visible"
            >
              <motion.div
                variants={staggerItem}
                className="inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-400/10 px-4 py-1.5 text-sm font-medium text-indigo-200"
              >
                <Fingerprint className="h-4 w-4" />
                Government-backed digital ID
              </motion.div>
              <motion.h1
                variants={staggerItem}
                className="text-5xl font-bold leading-[1.1] tracking-tight sm:text-6xl xl:text-7xl"
              >
                Know your{' '}
                <span className="relative whitespace-nowrap">
                  <span className="relative text-emerald-400">driver</span>
                  <svg
                    className="absolute -bottom-1 left-0 w-full"
                    viewBox="0 0 200 8"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <motion.path
                      d="M0 6 Q50 1 100 5 Q150 9 200 4"
                      stroke="#34d399"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.9, delay: 0.55, ease: easeOut }}
                    />
                  </svg>
                </span>
                {' '}before you ride.
              </motion.h1>
              <motion.p
                variants={staggerItem}
                className="max-w-lg text-lg text-indigo-200 leading-relaxed"
              >
                SafeRide lets passengers instantly verify that a boda boda or matatu driver is legitimate — no app, no account, no data plan required.
              </motion.p>
              <motion.div variants={staggerItem} className="flex flex-wrap gap-3">
                <Link href="/verify">
                  <Button size="lg" className="h-14 gap-2 bg-emerald-500 px-8 text-base font-semibold hover:bg-emerald-400 text-white shadow-lg shadow-emerald-900/30">
                    <QrCode className="h-5 w-5" />
                    Verify a Driver
                  </Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline" className="h-14 gap-2 border-indigo-400/40 bg-transparent px-8 text-base text-indigo-100 hover:bg-indigo-800/40 hover:text-white">
                    How it works
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </motion.div>
            </motion.div>

            {/* right — mock phone card */}
            <div className="flex justify-center lg:justify-end">
              <motion.div
                className="relative w-72"
                initial={{ opacity: 0, scale: 0.92, y: 28, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
                transition={{ duration: 0.75, delay: 0.2, ease: easeOut }}
              >
                {/* phone shell */}
                <motion.div
                  className="relative rounded-[2.5rem] border-4 border-indigo-700/60 bg-slate-900 p-4 shadow-2xl shadow-black/50"
                  animate={{ y: [0, -7, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {/* notch */}
                  <div className="mx-auto mb-3 h-5 w-20 rounded-full bg-slate-800" />
                  {/* screen content */}
                  <div className="rounded-2xl bg-white p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-indigo-600" />
                      <span className="text-xs font-semibold text-indigo-950 tracking-wide uppercase">SafeRide Verify</span>
                    </div>
                    {/* fake QR */}
                    <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50">
                      <QrCode className="h-20 w-20 text-indigo-300" />
                    </div>
                    {/* result card */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-emerald-800">James M.</span>
                        <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white">CLEAR ✓</span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-emerald-100">
                        <div className="h-full w-5/6 rounded-full bg-emerald-500" />
                      </div>
                      <div className="flex gap-2 text-[10px] text-emerald-700">
                        <span>KAA 001X</span>
                        <span>·</span>
                        <span>eSignet verified</span>
                      </div>
                    </div>
                    <div className="text-center text-[10px] text-slate-400">No app download required</div>
                  </div>
                  {/* home bar */}
                  <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-indigo-700/40" />
                </motion.div>
                {/* floating badge */}
                <motion.div
                  className="absolute -right-6 top-16 rounded-2xl border border-emerald-200 bg-white px-3 py-2 shadow-xl"
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.65, duration: 0.45, ease: easeOut }}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Verified in 3s
                  </div>
                </motion.div>
                <motion.div
                  className="absolute -left-6 bottom-24 rounded-2xl border border-indigo-200 bg-white px-3 py-2 shadow-xl"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.45, ease: easeOut }}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-indigo-700">
                    <ShieldCheck className="h-4 w-4 text-indigo-500" />
                    No account needed
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ────────────────────────────────────────────────────────── */}
      <section className="border-b bg-slate-50">
        <div className="container mx-auto max-w-5xl px-4 py-10">
          <motion.div
            className="grid grid-cols-2 gap-6 md:grid-cols-4"
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {STATS.map((s) => (
              <motion.div key={s.label} variants={scrollItem} className="space-y-1 text-center">
                <p className="text-3xl font-bold text-indigo-950">{s.value}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="container mx-auto max-w-5xl px-4">
          <motion.div
            className="mb-14 space-y-3 text-center"
            variants={scrollTitle}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">How it works</p>
            <h2 className="text-4xl font-bold tracking-tight text-indigo-950 sm:text-5xl">
              Four steps to safer transport
            </h2>
          </motion.div>
          <motion.div
            className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.num}
                  variants={scrollItem}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className={`relative rounded-2xl border ${step.border} bg-white p-6 shadow-sm space-y-4 transition-shadow hover:shadow-md`}
                >
                  <span className="absolute right-5 top-5 text-5xl font-black text-slate-50 select-none leading-none">
                    {step.num}
                  </span>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${step.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-bold text-indigo-950 text-base leading-snug">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.body}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── TRUST BANDS ──────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-slate-50 border-y">
        <div className="container mx-auto max-w-5xl px-4">
          <motion.div
            className="mb-14 space-y-3 text-center"
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <motion.p variants={scrollItem} className="text-sm font-semibold uppercase tracking-widest text-indigo-500">
              Trust system
            </motion.p>
            <motion.h2 variants={scrollItem} className="text-4xl font-bold tracking-tight text-indigo-950 sm:text-5xl">
              Instant, colour-coded trust
            </motion.h2>
            <motion.p variants={scrollItem} className="mx-auto max-w-xl text-muted-foreground text-lg">
              Every verification returns one of three bands. No ambiguity — just a clear answer before you board.
            </motion.p>
          </motion.div>
          <motion.div
            className="grid gap-5 md:grid-cols-3"
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {TRUST_BANDS.map((t) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.band}
                  variants={scrollItem}
                  whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
                  className={`rounded-2xl border-2 ${t.border} ${t.bg} space-y-4 p-8`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className={`h-8 w-8 ${t.icon_color}`} />
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${t.badge}`}>{t.band}</span>
                  </div>
                  <p className="text-slate-700 leading-relaxed">{t.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── CHANNELS ─────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="container mx-auto max-w-5xl px-4">
          <motion.div
            className="mb-14 space-y-3 text-center"
            variants={scrollTitle}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-500">Accessibility</p>
            <h2 className="text-4xl font-bold tracking-tight text-indigo-950 sm:text-5xl">
              Works on every phone
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground text-lg">
              SafeRide was built for East Africa — where not everyone has a smartphone or data bundle.
            </p>
          </motion.div>
          <motion.div
            className="grid gap-6 md:grid-cols-3"
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
          >
            {CHANNELS.map((ch) => {
              const Icon = ch.icon;
              return (
                <motion.div
                  key={ch.title}
                  variants={scrollItem}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className={`rounded-2xl ${ch.bg} ring-1 ${ch.ring} space-y-4 p-8`}
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-sm`}>
                    <Icon className={`h-6 w-6 ${ch.accent}`} />
                  </div>
                  <h3 className="text-xl font-bold text-indigo-950">{ch.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{ch.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ── PRIVACY ──────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-indigo-950 text-white">
        <div className="container mx-auto max-w-4xl space-y-8 px-4 text-center">
          <motion.div
            variants={scrollParent}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="space-y-8"
          >
            <motion.p variants={scrollItem} className="text-sm font-semibold uppercase tracking-widest text-indigo-400">
              Privacy-first
            </motion.p>
            <motion.h2 variants={scrollItem} className="text-4xl font-bold tracking-tight sm:text-5xl">
              Only what's needed. Nothing more.
            </motion.h2>
            <motion.p variants={scrollItem} className="mx-auto max-w-2xl text-lg leading-relaxed text-indigo-200">
              SafeRide uses minimal disclosure by design. A basic scan shows name and status. The driver must explicitly consent before phone or ID details are ever revealed. Your MSISDN is never stored unless you trigger an emergency.
            </motion.p>
            <motion.div
              variants={scrollParent}
              className="grid grid-cols-1 gap-6 pt-4 sm:grid-cols-3"
            >
              {[
                { icon: ShieldCheck, label: 'Driver consent required for extended details' },
                { icon: Fingerprint, label: 'Backed by government eSignet national ID' },
                { icon: UserCheck, label: 'No passenger account or tracking' },
              ].map(({ icon: Icon, label }) => (
                <motion.div
                  key={label}
                  variants={scrollItem}
                  whileHover={{ scale: 1.03, borderColor: 'rgba(52, 211, 153, 0.35)', transition: { duration: 0.2 } }}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-indigo-800 bg-indigo-900/50 p-6"
                >
                  <Icon className="h-7 w-7 text-emerald-400" />
                  <p className="text-sm leading-snug text-indigo-200">{label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── ASSOCIATION CTA ───────────────────────────────────────────────── */}
      <section className="border-y border-emerald-100 bg-emerald-50 py-20 md:py-28">
        <motion.div
          className="container mx-auto max-w-3xl space-y-6 px-4 text-center"
          variants={scrollParent}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <motion.p variants={scrollItem} className="text-sm font-semibold uppercase tracking-widest text-emerald-600">
            For transport associations
          </motion.p>
          <motion.h2 variants={scrollItem} className="text-4xl font-bold tracking-tight text-indigo-950 sm:text-5xl">
            Enrol your fleet.<br className="hidden sm:block" /> Build public trust.
          </motion.h2>
          <motion.p variants={scrollItem} className="text-lg leading-relaxed text-muted-foreground">
            Issue verifiable digital badges to your members, manage compliance, and give passengers confidence with a single platform built for SACCO and association operators.
          </motion.p>
          <motion.div variants={scrollItem} className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/how-it-works">
              <Button size="lg" className="h-12 gap-2 bg-indigo-600 px-8 text-base text-white hover:bg-indigo-700">
                Learn more
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
      </section>

      <Footer />
    </div>
  );
}
