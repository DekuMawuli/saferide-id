'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewOperatorPage() {
  const router = useRouter();
  const [step, setStep] = useState('identity');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      router.push('/portal');
    }, 1500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <div className="mb-6">
          <Link href="/portal" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-indigo-950">Enroll New Operator</h1>
          <p className="text-muted-foreground">Register a new driver and bind their vehicle.</p>
        </div>

        <Card className="border-0 shadow-md">
          <Tabs value={step} onValueChange={setStep} className="w-full">
            <CardHeader className="border-b bg-slate-50/50">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="identity">1. Identity</TabsTrigger>
                <TabsTrigger value="vehicle">2. Vehicle</TabsTrigger>
                <TabsTrigger value="review">3. Review</TabsTrigger>
              </TabsList>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="pt-6">
                <TabsContent value="identity" className="space-y-6 mt-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-indigo-950">Personal Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input id="firstName" placeholder="e.g. John" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name</Label>
                        <Input id="lastName" placeholder="e.g. Doe" required />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="nationalId">National ID Number</Label>
                      <Input id="nationalId" placeholder="CM..." required />
                      <p className="text-xs text-muted-foreground">Used to verify identity against the national registry.</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Operator Photo</Label>
                      <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer">
                        <Upload className="h-8 w-8 text-indigo-400 mb-2" />
                        <p className="text-sm font-medium text-indigo-950">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground">SVG, PNG, JPG or GIF (max. 5MB)</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="association">Transport Association / Stage</Label>
                      <Select required>
                        <SelectTrigger>
                          <SelectValue placeholder="Select association" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="kampala-central">Kampala Central Boda Association</SelectItem>
                          <SelectItem value="entebbe-taxis">Entebbe Stage Taxis</SelectItem>
                          <SelectItem value="gulu-riders">Gulu Riders Union</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-4">
                    <Button type="button" onClick={() => setStep('vehicle')} className="bg-indigo-600 hover:bg-indigo-700">
                      Next: Vehicle Details
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="vehicle" className="space-y-6 mt-0">
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium text-indigo-950">Vehicle Binding</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="plate">License Plate</Label>
                        <Input id="plate" placeholder="e.g. UAB 123C" className="uppercase" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category">Vehicle Category</Label>
                        <Select required>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="motorcycle">Motorcycle (Boda Boda)</SelectItem>
                            <SelectItem value="minibus">Minibus (Taxi)</SelectItem>
                            <SelectItem value="sedan">Sedan (Special Hire)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="makeModel">Make & Model</Label>
                        <Input id="makeModel" placeholder="e.g. Bajaj Boxer" required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="color">Color</Label>
                        <Input id="color" placeholder="e.g. Red" required />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="ownership">Ownership Note</Label>
                      <Textarea id="ownership" placeholder="Owner details or authorization note..." className="resize-none" />
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep('identity')}>
                      Back
                    </Button>
                    <Button type="button" onClick={() => setStep('review')} className="bg-indigo-600 hover:bg-indigo-700">
                      Next: Review
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="review" className="space-y-6 mt-0">
                  <div className="space-y-6">
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-indigo-950">Ready for Enrollment</h4>
                        <p className="text-sm text-indigo-800 mt-1">
                          Please review the details below. Upon submission, a unique SafeRide code will be generated and the operator will be marked as Active.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 border-b pb-2">Identity Summary</h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between"><dt className="text-muted-foreground">Name:</dt><dd className="font-medium">John Doe</dd></div>
                          <div className="flex justify-between"><dt className="text-muted-foreground">National ID:</dt><dd className="font-medium">CM12345678</dd></div>
                          <div className="flex justify-between"><dt className="text-muted-foreground">Association:</dt><dd className="font-medium">Kampala Central</dd></div>
                        </dl>
                      </div>
                      <div className="space-y-4">
                        <h4 className="font-semibold text-slate-900 border-b pb-2">Vehicle Summary</h4>
                        <dl className="space-y-2 text-sm">
                          <div className="flex justify-between"><dt className="text-muted-foreground">Plate:</dt><dd className="font-medium">UAB 123C</dd></div>
                          <div className="flex justify-between"><dt className="text-muted-foreground">Category:</dt><dd className="font-medium">Motorcycle</dd></div>
                          <div className="flex justify-between"><dt className="text-muted-foreground">Make/Color:</dt><dd className="font-medium">Bajaj Boxer, Red</dd></div>
                        </dl>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between pt-4">
                    <Button type="button" variant="outline" onClick={() => setStep('vehicle')} disabled={isSubmitting}>
                      Back
                    </Button>
                    <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={isSubmitting}>
                      {isSubmitting ? 'Enrolling...' : 'Confirm & Enroll'}
                      {!isSubmitting && <CheckCircle2 className="ml-2 h-4 w-4" />}
                    </Button>
                  </div>
                </TabsContent>
              </CardContent>
            </form>
          </Tabs>
        </Card>
      </main>
    </div>
  );
}
