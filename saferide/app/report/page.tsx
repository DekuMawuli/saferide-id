'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertOctagon, CheckCircle2, ArrowLeft } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { isApiConfigured } from '@/lib/api/config';
import { postPublicReport } from '@/lib/api/public-trust';

function ReportForm() {
  const searchParams = useSearchParams();
  const opCode = searchParams.get('op') || '';

  const [operatorCode, setOperatorCode] = useState(opCode);
  const [incidentType, setIncidentType] = useState('');
  const [location, setLocation] = useState('');
  const [details, setDetails] = useState('');
  const [contact, setContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isApiConfigured()) {
      setError('Set NEXT_PUBLIC_API_URL');
      return;
    }
    if (!incidentType || !details.trim()) {
      setError('Type and details are required');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await postPublicReport({
        operator_code: operatorCode.trim() || null,
        incident_type: incidentType,
        details: details.trim(),
        location: location.trim() || null,
        contact: contact.trim() || null,
      });
      setIsSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="border-0 shadow-md">
        <CardContent className="flex flex-col items-center space-y-4 p-8 text-center">
          <div className="rounded-full bg-emerald-100 p-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          </div>
          <h3 className="text-xl font-bold text-indigo-950">Report submitted</h3>
          <p className="text-muted-foreground">
            Stored via <code className="text-xs">POST /public/report</code>. Simulated SMS may notify configured
            recipients.
          </p>
          <Link href="/" className="mt-4 w-full">
            <Button className="w-full bg-indigo-600 hover:bg-indigo-700">Return home</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-md">
      <form onSubmit={(e) => void handleSubmit(e)}>
        <CardHeader>
          <div className="mb-2 flex items-center gap-3">
            <div className="rounded-lg bg-red-100 p-2">
              <AlertOctagon className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl">Report an issue</CardTitle>
          </div>
          <CardDescription>
            No login required. Linked to Milestone 5 / authority workflows (simulated notifications).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="space-y-2">
            <Label htmlFor="operatorCode">Driver / vehicle code</Label>
            <Input
              id="operatorCode"
              placeholder="Short code"
              value={operatorCode}
              onChange={(e) => setOperatorCode(e.target.value)}
              className="uppercase"
            />
          </div>

          <div className="space-y-2">
            <Label>Type of issue</Label>
            <Select
              value={incidentType}
              onValueChange={(v) => setIncidentType(v ?? '')}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mismatch">Driver / vehicle mismatch</SelectItem>
                <SelectItem value="reckless">Reckless driving</SelectItem>
                <SelectItem value="harassment">Harassment / unsafe behavior</SelectItem>
                <SelectItem value="overcharging">Overcharging</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location (optional)</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="details">Details</Label>
            <Textarea
              id="details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="min-h-[120px]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact">Your contact (optional)</Label>
            <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full bg-red-600 hover:bg-red-700" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit report'}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            In an emergency, contact local police. Panic share lives on the verify result page.
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}

export default function ReportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="container mx-auto max-w-lg flex-1 px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link href="/verify" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </div>

        <Suspense fallback={<div className="p-8 text-center">Loading form…</div>}>
          <ReportForm />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
