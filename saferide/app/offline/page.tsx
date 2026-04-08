'use client';

import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { WifiOff, RefreshCw, Home } from 'lucide-react';

export default function OfflineFallbackPage() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-12 md:py-24 flex items-center justify-center">
        <Card className="w-full max-w-md border-0 shadow-lg overflow-hidden text-center">
          <div className="h-2 bg-slate-400" />
          <CardHeader className="pb-4 pt-8">
            <div className="mx-auto bg-slate-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4">
              <WifiOff className="h-10 w-10 text-slate-500" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">You&apos;re Offline</CardTitle>
            <CardDescription className="text-base mt-2">
              It looks like you&apos;ve lost your internet connection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 text-left">
              <p className="font-semibold mb-1">Verification requires connectivity</p>
              <p>To securely check an operator&apos;s live status and identity, SafeRide needs an active internet connection to query the trusted database.</p>
            </div>
            
            <div className="flex flex-col gap-3 pt-4">
              <Button 
                onClick={handleRetry}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Try Again
              </Button>
              <Link href="/">
                <Button variant="outline" className="w-full border-slate-300 text-slate-700">
                  <Home className="mr-2 h-4 w-4" /> Return Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </main>
      
      <Footer />
    </div>
  );
}
