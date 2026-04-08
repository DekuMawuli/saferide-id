import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Scale, FileText, ShieldCheck } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1">
        <section className="w-full bg-indigo-950 py-12 text-white md:py-24">
          <div className="container mx-auto px-4 text-center md:px-6">
            <div className="mx-auto mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
                <Scale className="h-7 w-7 text-emerald-400" />
              </div>
            </div>
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Terms of Service</h1>
            <p className="mx-auto mt-4 max-w-[700px] text-indigo-200 md:text-xl">
              Rules for using SafeRide verification, portals, and related services.
            </p>
            <p className="mt-4 text-sm text-indigo-400">Last updated: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </section>

        <section className="w-full bg-white py-16 md:py-24">
          <div className="container mx-auto max-w-4xl space-y-12 px-4 md:px-6">
            <div className="prose prose-slate max-w-none space-y-4 text-muted-foreground">
              <p className="text-lg text-slate-700">
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of SafeRide websites, APIs, USSD flows, and related offerings (collectively, the &quot;Service&quot;). By using the Service, you agree to these Terms.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="flex items-center gap-3 text-2xl font-bold text-indigo-950">
                <FileText className="h-6 w-6 shrink-0 text-indigo-600" />
                1. The Service
              </h2>
              <p className="text-muted-foreground">
                SafeRide provides tools for transport associations and the public to verify driver and rider trust signals, manage enrollments, and report safety concerns. Features may include QR and short-code verification, officer and admin portals, and integrations with national digital identity infrastructure (such as eSignet) where configured.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">2. Eligibility and accounts</h2>
              <p className="text-muted-foreground">
                You must provide accurate information when creating or using an account. Association officers and administrators act on behalf of their organization and are responsible for how their credentials are used. You are responsible for safeguarding passwords and tokens issued to you.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">3. Acceptable use</h2>
              <ul className="list-inside list-disc space-y-2 text-muted-foreground">
                <li>Do not misuse the Service to stalk, harass, or discriminate.</li>
                <li>Do not attempt to bypass verification, scrape personal data beyond what the Service explicitly exposes, or probe systems without authorization.</li>
                <li>Do not use outputs of the Service as the sole basis for unlawful detention or denial of essential services; local law and operator policy always apply.</li>
              </ul>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-100 bg-slate-50 p-8">
              <h2 className="flex items-center gap-3 text-2xl font-bold text-indigo-950">
                <ShieldCheck className="h-6 w-6 shrink-0 text-emerald-600" />
                4. Identity, verification, and third parties
              </h2>
              <p className="text-muted-foreground">
                Verification may rely on identity providers and registries outside SafeRide. SafeRide does not guarantee uninterrupted availability of those systems. Displayed trust status reflects data available at verification time and configured disclosure rules—not a legal warrant of fitness to drive or carry passengers.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">5. Intellectual property</h2>
              <p className="text-muted-foreground">
                SafeRide branding, software, and documentation are protected. You receive a limited, non-exclusive right to use the Service as offered. You may not reverse engineer or resell the Service except as expressly permitted in writing.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">6. Disclaimers</h2>
              <p className="text-muted-foreground">
                The Service is provided &quot;as is&quot; to the maximum extent permitted by law. We disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement where allowed.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">7. Limitation of liability</h2>
              <p className="text-muted-foreground">
                To the extent permitted by applicable law, SafeRide and its contributors are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits or data, arising from your use of the Service. Aggregate liability for direct damages may be limited as set forth in a separate agreement with your organization, if any.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-indigo-950">8. Changes</h2>
              <p className="text-muted-foreground">
                We may update these Terms. We will post the revised version on this page and update the &quot;Last updated&quot; date. Continued use after changes constitutes acceptance where permitted by law.
              </p>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-8">
              <h2 className="text-2xl font-bold text-indigo-950">9. Related policies</h2>
              <p className="text-muted-foreground">
                Our{' '}
                <Link href="/privacy" className="font-medium text-indigo-600 hover:underline">
                  Privacy Policy
                </Link>{' '}
                and{' '}
                <Link href="/data-consent" className="font-medium text-indigo-600 hover:underline">
                  Data Consent
                </Link>{' '}
                page describe how personal data is handled and how consent works in the product.
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
