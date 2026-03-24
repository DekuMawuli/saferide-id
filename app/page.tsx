import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, QrCode, UserCheck, AlertTriangle, ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-indigo-950 text-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:gap-12 xl:grid-cols-[1fr_600px]">
              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-4">
                  <div className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-sm font-medium text-indigo-200">
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Digital ID-Backed Trust
                  </div>
                  <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none">
                    Verify before you ride.
                  </h1>
                  <p className="max-w-[600px] text-indigo-200 md:text-xl">
                    SafeRide helps passengers verify that a driver and vehicle are legitimate before boarding. Built for informal transport, anchored in public trust.
                  </p>
                </div>
                <div className="flex flex-col gap-3 min-[400px]:flex-row">
                  <Link href="/verify">
                    <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-8 text-lg">
                      <QrCode className="mr-2 h-5 w-5" />
                      Verify a Driver
                    </Button>
                  </Link>
                  <Link href="/portal">
                    <Button size="lg" variant="outline" className="w-full bg-transparent border-indigo-400 text-indigo-100 hover:bg-indigo-900 h-14 px-8 text-lg">
                      For Partners
                    </Button>
                  </Link>
                </div>
              </div>
              <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-6 lg:max-w-none">
                <Card className="border-0 shadow-2xl bg-white/10 backdrop-blur-md text-white">
                  <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                    <div className="p-4 bg-white rounded-2xl shadow-inner">
                      <QrCode className="h-32 w-32 text-indigo-950" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold">Scan to Verify</h3>
                      <p className="text-indigo-200">Ask your driver for their SafeRide QR code or short code to instantly check their status.</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="w-full py-16 md:py-24 bg-white">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-12">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-indigo-950">How Verification Works</h2>
              <p className="max-w-[700px] text-muted-foreground md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Three simple steps to ensure your safety before every journey.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="flex flex-col items-center text-center space-y-4 p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <QrCode className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">1. Scan or Enter Code</h3>
                <p className="text-muted-foreground">Scan the driver&apos;s QR code or enter their unique short code displayed on their vest or vehicle.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4 p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <UserCheck className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">2. Check Identity</h3>
                <p className="text-muted-foreground">Instantly see the driver&apos;s verified photo, name, and current operating status.</p>
              </div>
              <div className="flex flex-col items-center text-center space-y-4 p-6">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                  <AlertTriangle className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-indigo-950">3. Ride or Report</h3>
                <p className="text-muted-foreground">Board with confidence, or easily report any mismatches or suspicious behavior.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Safety & Privacy */}
        <section className="w-full py-16 md:py-24 bg-slate-50 border-t">
          <div className="container px-4 md:px-6 mx-auto">
            <div className="grid gap-10 lg:grid-cols-2 items-center">
              <div className="space-y-6">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl text-indigo-950">Privacy-First Safety</h2>
                <p className="text-muted-foreground text-lg">
                  SafeRide is built on the principle of minimal disclosure. We protect both passengers and drivers by only sharing what is absolutely necessary for trust.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-indigo-950">Driver Consent</h4>
                      <p className="text-sm text-muted-foreground">Drivers explicitly consent to sharing their verification status.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-indigo-950">No Tracking</h4>
                      <p className="text-sm text-muted-foreground">We do not track your live location during the ride unless you trigger an emergency report.</p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <ShieldCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div>
                      <h4 className="font-semibold text-indigo-950">Data Minimization</h4>
                      <p className="text-sm text-muted-foreground">Only essential identity facts (photo, name, status) are displayed.</p>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-sm border">
                <div className="space-y-6">
                  <h3 className="text-2xl font-bold text-indigo-950">For Transport Associations</h3>
                  <p className="text-muted-foreground">
                    Enroll your members, issue verifiable digital badges, and manage compliance through our secure officer portal.
                  </p>
                  <Link href="/portal" className="inline-flex items-center text-indigo-600 font-semibold hover:text-indigo-700">
                    Access Officer Portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
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
