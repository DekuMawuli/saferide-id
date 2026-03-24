'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode, Search, ShieldAlert } from 'lucide-react';

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      // In a real app, this would validate the code format first
      router.push(`/verify/result/${code.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-md">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-indigo-950">Verify Driver</h1>
            <p className="text-muted-foreground">Scan the QR code or enter the driver&apos;s short code before boarding.</p>
          </div>

          <Card className="border-0 shadow-md">
            <CardHeader>
              <CardTitle>Scan QR Code</CardTitle>
              <CardDescription>Point your camera at the driver&apos;s SafeRide badge</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              {isScanning ? (
                <div className="w-full aspect-square bg-slate-900 rounded-xl relative overflow-hidden flex items-center justify-center">
                  <div className="absolute inset-0 border-4 border-emerald-500/50 m-8 rounded-lg"></div>
                  <div className="w-full h-1 bg-emerald-500 absolute top-1/2 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
                  <p className="text-white text-sm mt-auto mb-4 z-10">Scanning...</p>
                </div>
              ) : (
                <Button 
                  size="lg" 
                  className="w-full h-32 flex flex-col gap-3 bg-slate-100 hover:bg-slate-200 text-indigo-950 border-2 border-dashed border-slate-300"
                  onClick={() => setIsScanning(true)}
                >
                  <QrCode className="h-10 w-10 text-indigo-600" />
                  <span>Tap to Scan QR Code</span>
                </Button>
              )}
            </CardContent>
            {isScanning && (
              <CardFooter>
                <Button variant="outline" className="w-full" onClick={() => setIsScanning(false)}>
                  Cancel Scan
                </Button>
              </CardFooter>
            )}
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-slate-50 px-2 text-muted-foreground">Or enter manually</span>
            </div>
          </div>

          <Card className="border-0 shadow-md">
            <form onSubmit={handleVerify}>
              <CardHeader>
                <CardTitle>Enter Short Code</CardTitle>
                <CardDescription>Type the 6-character code on the vehicle</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Driver Code</Label>
                  <Input 
                    id="code" 
                    placeholder="e.g. BODA-782" 
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="text-lg uppercase"
                    maxLength={10}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={!code.trim()}>
                  <Search className="mr-2 h-4 w-4" />
                  Verify Code
                </Button>
              </CardFooter>
            </form>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3 text-amber-800">
            <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div className="text-sm">
              <p className="font-semibold">Safety First</p>
              <p>Do not board if the driver refuses verification or if the details do not match.</p>
              <p className="mt-2 text-xs">
                No smartphone? Try the{' '}
                <a href="/simulate/ussd" className="font-medium text-amber-900 underline">
                  USSD simulator
                </a>{' '}
                or{' '}
                <a href="/simulate/sms" className="font-medium text-amber-900 underline">
                  SMS outbox
                </a>{' '}
                (lab — no login).
              </p>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
