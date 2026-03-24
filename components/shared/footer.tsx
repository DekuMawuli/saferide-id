import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="container mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="flex flex-col gap-4">
            <Link href="/" className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-indigo-600" />
              <span className="text-xl font-bold tracking-tight text-indigo-950">SafeRide</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Digital ID-backed trust platform for informal transport. Verify before you ride.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-indigo-950">Passengers</h4>
            <Link href="/verify" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Verify a Driver</Link>
            <Link href="/report" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Report an Issue</Link>
            <Link href="/how-it-works" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">How it Works</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-indigo-950">Partners</h4>
            <Link href="/portal" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Officer Portal</Link>
            <Link href="/partners" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Become a Partner</Link>
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Admin Dashboard</Link>
          </div>
          <div className="flex flex-col gap-3">
            <h4 className="font-semibold text-indigo-950">Trust & Safety</h4>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Terms of Service</Link>
            <Link href="/data-consent" className="text-sm text-muted-foreground hover:text-indigo-600 transition-colors">Data Consent</Link>
          </div>
        </div>
        <div className="mt-12 pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} SafeRide Initiative. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
