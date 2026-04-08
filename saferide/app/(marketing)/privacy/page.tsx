import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { ShieldCheck, Lock, EyeOff, FileText } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 bg-indigo-950 text-white">
          <div className="container px-4 md:px-6 mx-auto text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">Trust & Privacy</h1>
            <p className="max-w-[700px] mx-auto mt-4 text-indigo-200 md:text-xl">
              Our commitment to protecting your data while ensuring public safety.
            </p>
          </div>
        </section>

        <section className="w-full py-16 md:py-24 bg-white">
          <div className="container px-4 md:px-6 mx-auto max-w-4xl space-y-12">
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-indigo-950">Privacy by Design</h2>
              <p className="text-lg text-muted-foreground">
                SafeRide is built on the principle of minimal disclosure. We believe that safety should not come at the cost of privacy. Our system is designed to share only the absolute minimum information necessary to establish trust between a passenger and a driver.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-4">
                <div className="bg-indigo-100 w-12 h-12 rounded-full flex items-center justify-center text-indigo-600 mb-6">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">For Drivers</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Your National ID number is never shared with passengers.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Your private contact details are kept secure.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>You explicitly consent to sharing your verification status.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-4">
                <div className="bg-emerald-100 w-12 h-12 rounded-full flex items-center justify-center text-emerald-600 mb-6">
                  <EyeOff className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">For Passengers</h3>
                <ul className="space-y-3 text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>We do not track your live location during the ride.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Your scan history is anonymized.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Emergency reports are handled securely and confidentially.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="space-y-6 pt-8 border-t">
              <h2 className="text-2xl font-bold text-indigo-950 flex items-center gap-3">
                <FileText className="h-6 w-6 text-indigo-600" />
                Data Handling Policy
              </h2>
              <div className="prose prose-slate max-w-none text-muted-foreground">
                <p>
                  All identity verification is performed against official national registries (e.g., NIRA) using secure, encrypted channels. SafeRide does not store full biometric profiles; we only store the cryptographic proof of verification and the necessary display data (photo, name, vehicle).
                </p>
                <p className="mt-4">
                  Data access is strictly role-based. Enrollment officers can only view data for operators within their specific association. System administrators have audited access for compliance and incident resolution only.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
