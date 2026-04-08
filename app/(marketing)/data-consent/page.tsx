import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { ClipboardCheck, Lock, UserCheck, ShieldCheck } from 'lucide-react';

export default function DataConsentPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        <section className="w-full bg-indigo-950 py-12 text-white md:py-24">
          <div className="container mx-auto px-4 text-center md:px-6">
            <div className="mx-auto mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <ClipboardCheck className="h-7 w-7 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Data Consent</h1>
            <p className="mx-auto mt-4 max-w-[700px] text-indigo-200 md:text-xl">
              How SafeRide collects, uses, and shares data—with your clear consent where the law or product flow requires it.
            </p>
            <p className="mt-4 text-sm text-indigo-400">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </section>

        <section className="w-full bg-white py-16 md:py-24">
          <div className="container mx-auto max-w-4xl space-y-12 px-4 md:px-6">
            <div className="prose prose-slate max-w-none space-y-4 text-muted-foreground">
              <p className="text-lg text-slate-700">
                This page explains consent-related processing for SafeRide. It complements our{' '}
                <Link href="/privacy" className="font-medium text-indigo-600 hover:underline">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/terms" className="font-medium text-indigo-600 hover:underline">
                  Terms of Service
                </Link>
                . If you use verification flows, portals, or demos, you should read all three.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">1. What &quot;consent&quot; means here</h2>
              <p className="text-muted-foreground">
                Where we ask for consent, it is a clear, affirmative action (for example, approving a consent request in the driver app, or continuing after a disclosure notice on a verification page). Consent is specific to the purpose described at the time we request it. You can decline; some features may not work without the minimum data needed for that feature.
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2">
              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <UserCheck className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">2. Drivers and operators</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>Enrollment and identity checks may use national digital ID (e.g. eSignet). You agree to the scopes presented by your identity provider at login.</span>
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>Passengers may see a minimal trust view (for example name band and status) without extra consent. Phone or extended fields require an in-app consent request you can approve or deny.</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">3. Passengers and the public</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>Verifying a code or QR uses the data needed to show the configured disclosure tier only.</span>
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <span>USSD or SMS demos may log simulated or test identifiers; production deployments should follow your operator&apos;s privacy notice.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">4. Categories of data</h2>
              <p className="text-muted-foreground">
                Depending on your role and flows, we may process account identifiers (email, phone), profile and verification attributes from an IdP, vehicle and association metadata, short verification codes, audit and security logs, and incident reports you submit. We apply{' '}
                <strong className="font-medium text-slate-800">minimal disclosure</strong> by design: more sensitive fields are gated behind explicit consent or officer-only governance views.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">5. Withdrawal and retention</h2>
              <p className="text-muted-foreground">
                Where processing is based on consent, you may withdraw consent when product controls allow it (for example, declining or revoking a consent request). Withdrawal does not affect prior processing that was lawful. Some records may be retained for security, fraud prevention, or legal obligations; retention periods depend on deployment policy and applicable law.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">6. Children</h2>
              <p className="text-muted-foreground">
                The Service is not directed at children. Association-operated programs should ensure enrollments comply with local age and guardian rules.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold text-indigo-950">7. Contact</h2>
              <p className="text-muted-foreground">
                For privacy or consent questions, contact your transport association or the organization operating this SafeRide deployment. For product feedback, you may use{' '}
                <Link href="/report" className="font-medium text-indigo-600 hover:underline">
                  Report an Issue
                </Link>
                .
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
