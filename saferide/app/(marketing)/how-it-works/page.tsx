import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { ShieldCheck, QrCode, UserCheck, AlertTriangle, Car, FileText } from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 bg-indigo-950 text-white">
          <div className="container px-4 md:px-6 mx-auto text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl">How SafeRide Works</h1>
            <p className="max-w-[700px] mx-auto mt-4 text-indigo-200 md:text-xl">
              A simple, secure process to verify drivers and vehicles before every journey.
            </p>
          </div>
        </section>

        <section className="w-full py-16 md:py-24 bg-white">
          <div className="container px-4 md:px-6 mx-auto max-w-4xl">
            <div className="space-y-16">
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xl mb-4">1</div>
                  <h2 className="text-3xl font-bold text-indigo-950">Enrollment & Verification</h2>
                  <p className="text-lg text-muted-foreground">
                    Drivers are enrolled by trusted transport associations or authorities. Their identity is verified against national registries, and their vehicle is officially bound to their profile.
                  </p>
                  <ul className="space-y-3 mt-6">
                    <li className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-emerald-600" />
                      <span>National ID verification</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <Car className="h-5 w-5 text-emerald-600" />
                      <span>Vehicle registration check</span>
                    </li>
                  </ul>
                </div>
                <div className="order-1 md:order-2 bg-slate-100 rounded-2xl p-8 flex items-center justify-center aspect-square">
                  <ShieldCheck className="w-32 h-32 text-indigo-300" />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="bg-slate-100 rounded-2xl p-8 flex items-center justify-center aspect-square">
                  <QrCode className="w-32 h-32 text-indigo-300" />
                </div>
                <div className="space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xl mb-4">2</div>
                  <h2 className="text-3xl font-bold text-indigo-950">Passenger Scanning</h2>
                  <p className="text-lg text-muted-foreground">
                    Before boarding, passengers scan the driver&apos;s unique SafeRide QR code or enter their short code. This instantly queries the secure database for the driver&apos;s current status.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 space-y-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xl mb-4">3</div>
                  <h2 className="text-3xl font-bold text-indigo-950">Instant Trust Decision</h2>
                  <p className="text-lg text-muted-foreground">
                    The passenger receives a clear, color-coded result showing the driver&apos;s verified photo, name, vehicle details, and operating status (Active, Suspended, or Expired).
                  </p>
                  <ul className="space-y-3 mt-6">
                    <li className="flex items-center gap-3">
                      <UserCheck className="h-5 w-5 text-emerald-600" />
                      <span>Verified photo & name</span>
                    </li>
                    <li className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600" />
                      <span>Clear safety warnings</span>
                    </li>
                  </ul>
                </div>
                <div className="order-1 md:order-2 bg-slate-100 rounded-2xl p-8 flex items-center justify-center aspect-square">
                  <UserCheck className="w-32 h-32 text-indigo-300" />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      
      <Footer />
    </div>
  );
}
