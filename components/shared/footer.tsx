import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-indigo-950 text-indigo-200">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              <span className="text-xl font-bold tracking-tight text-white">SafeRide</span>
            </Link>
            <p className="text-sm text-indigo-300 max-w-xs">
              Digital ID-backed trust for informal transport. Verify before you ride — no app required.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-white">Passengers</h4>
            <Link href="/verify" className="text-sm text-indigo-300 hover:text-white transition-colors">Verify a Driver</Link>
            <Link href="/simulate/ussd" className="text-sm text-indigo-300 hover:text-white transition-colors">Try USSD Demo</Link>
            <Link href="/report" className="text-sm text-indigo-300 hover:text-white transition-colors">Report an Issue</Link>
            <Link href="/how-it-works" className="text-sm text-indigo-300 hover:text-white transition-colors">How it Works</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-white">Trust & Safety</h4>
            <Link href="/privacy" className="text-sm text-indigo-300 hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-indigo-300 hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/data-consent" className="text-sm text-indigo-300 hover:text-white transition-colors">Data Consent</Link>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t border-indigo-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-indigo-400">
            &copy; {new Date().getFullYear()} SafeRide Initiative. All rights reserved.
          </p>
          <p className="text-xs text-indigo-500">Built on open digital public infrastructure · Powered by eSignet</p>
        </div>
      </div>
    </footer>
  );
}
