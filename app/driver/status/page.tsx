'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Calendar, RefreshCw, ArrowLeft } from 'lucide-react';
import { mockOperators } from '@/lib/mock-data';

export default function DriverStatusPage() {
  // Mock logged-in driver
  const driver = mockOperators[0];

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active</Badge>;
      case 'suspended':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Suspended</Badge>;
      case 'expired':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-3xl">
        <div className="mb-6">
          <Link href="/driver/profile" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Verification Status</h1>
          <p className="text-muted-foreground mt-1">Review your current SafeRide credentials and compliance state.</p>
        </div>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className={`h-2 ${driver.status === 'active' ? 'bg-emerald-500' : driver.status === 'suspended' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-bold text-slate-800">Current Status</CardTitle>
                {renderStatusBadge(driver.status)}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Issue Date
                  </p>
                  <p className="text-lg font-medium text-slate-900">Jan 12, 2026</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    <Calendar className="h-4 w-4" /> Expiry Date
                  </p>
                  <p className="text-lg font-medium text-slate-900">Jan 12, 2027</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" /> Last Review
                  </p>
                  <p className="text-lg font-medium text-slate-900">Mar 01, 2026</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-800">Validity Timeline</CardTitle>
              <CardDescription>Your credential lifecycle and upcoming milestones.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-4">
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                  <h4 className="font-semibold text-slate-900">Identity Verified</h4>
                  <p className="text-sm text-muted-foreground">National ID and background check passed.</p>
                  <span className="text-xs text-slate-500 mt-1 block">Jan 10, 2026</span>
                </div>
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                  <h4 className="font-semibold text-slate-900">Vehicle Bound</h4>
                  <p className="text-sm text-muted-foreground">Assigned to vehicle {driver.vehicle.plate}.</p>
                  <span className="text-xs text-slate-500 mt-1 block">Jan 12, 2026</span>
                </div>
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 h-4 w-4 rounded-full bg-slate-300 border-2 border-white"></div>
                  <h4 className="font-semibold text-slate-900">Annual Renewal</h4>
                  <p className="text-sm text-muted-foreground">Required to maintain active status.</p>
                  <span className="text-xs text-slate-500 mt-1 block">Due: Jan 12, 2027</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-indigo-900">Need Help?</h4>
              <p className="text-sm text-indigo-800">
                If your status is incorrect or you need to renew your credentials, contact your association officer.
              </p>
            </div>
            <Button variant="outline" className="bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-100 shrink-0">
              Contact Support
            </Button>
          </div>
        </div>
      </div>
  );
}
