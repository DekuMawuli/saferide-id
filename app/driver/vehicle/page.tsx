'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Car, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import { mockOperators } from '@/lib/mock-data';

export default function DriverVehiclePage() {
  // Mock logged-in driver
  const driver = mockOperators[0];

  return (
    <div className="container mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/driver/profile" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Assigned Vehicle</h1>
          <p className="text-muted-foreground mt-1">View the vehicle currently bound to your SafeRide profile.</p>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Car className="h-6 w-6 text-indigo-600" />
                  Vehicle Details
                </CardTitle>
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Active Assignment
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">License Plate</p>
                  <p className="text-2xl font-mono font-bold text-indigo-950">{driver.vehicle.plate}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Vehicle Type</p>
                  <p className="text-lg font-medium text-slate-900 capitalize">{driver.vehicle.category}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Make & Model</p>
                  <p className="text-lg font-medium text-slate-900">{driver.vehicle.makeModel}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500">Color</p>
                  <p className="text-lg font-medium text-slate-900 capitalize">{driver.vehicle.color}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-indigo-50">
            <CardHeader>
              <CardTitle className="text-indigo-900 text-lg">Authorization Status</CardTitle>
              <CardDescription className="text-indigo-700">
                This vehicle is authorized for your use by your association.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center p-4 bg-white rounded-lg border border-indigo-100">
                <div>
                  <p className="font-medium text-slate-900">Association</p>
                  <p className="text-sm text-muted-foreground">{driver.association}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-medium text-slate-900">Last Verified</p>
                  <p className="text-sm text-muted-foreground">Today, 08:00 AM</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5 flex gap-4 items-start">
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-3">
              <div>
                <h4 className="text-base font-semibold text-amber-900">Are these details incorrect?</h4>
                <p className="text-sm text-amber-800 mt-1">
                  If you have changed vehicles or notice an error in these details, you must request a correction. Operating a vehicle that does not match your SafeRide profile may result in suspension.
                </p>
              </div>
              <Button variant="outline" className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100">
                Request Correction
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
