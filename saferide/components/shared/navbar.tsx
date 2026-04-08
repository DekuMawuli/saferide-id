import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-indigo-600" />
          <span className="text-xl font-bold tracking-tight text-indigo-950">SafeRide</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6">
          <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it works</Link>
          <Link href="/privacy" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Trust & Privacy</Link>
          <Link href="/simulate/ussd" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Try USSD</Link>
          <Link href="/verify">
            <Button variant="default" className="bg-indigo-600 hover:bg-indigo-700">Verify Driver</Button>
          </Link>
        </nav>
        <Sheet>
          <SheetTrigger className="md:hidden inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-slate-100 h-10 w-10">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </SheetTrigger>
          <SheetContent side="right">
            <div className="flex flex-col gap-4 mt-8">
              <Link href="/how-it-works" className="text-lg font-medium">How it works</Link>
              <Link href="/privacy" className="text-lg font-medium">Trust & Privacy</Link>
              <Link href="/simulate/ussd" className="text-lg font-medium">Try USSD</Link>
              <Link href="/verify" className="mt-4">
                <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Verify driver</Button>
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
