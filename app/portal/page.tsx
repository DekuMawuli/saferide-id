'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, ShieldAlert, PlusCircle, Search, ArrowRight, FileText } from 'lucide-react';
import { mockOperators, mockIncidents } from '@/lib/mock-data';

export default function PortalDashboard() {
  const activeOperators = mockOperators.filter(op => op.status === 'active').length;
  const suspendedOperators = mockOperators.filter(op => op.status === 'suspended').length;
  const openIncidents = mockIncidents.filter(inc => inc.status === 'open').length;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-950">Officer Portal</h1>
            <p className="text-muted-foreground">Manage your association&apos;s operators and vehicles.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/portal/operators/new">
              <Button className="bg-indigo-600 hover:bg-indigo-700">
                <PlusCircle className="mr-2 h-4 w-4" />
                Enroll Operator
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Operators</CardTitle>
              <Users className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{activeOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-emerald-600 font-medium">+2</span> since last week
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Suspended</CardTitle>
              <ShieldAlert className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{suspendedOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires review
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Open Incidents</CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{openIncidents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-amber-600 font-medium">+1</span> new today
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Recent Enrollments</CardTitle>
                  <CardDescription>Latest operators added to your association.</CardDescription>
                </div>
                <Link href="/portal/operators">
                  <Button variant="ghost" size="sm" className="text-indigo-600">
                    View All <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockOperators.slice(0, 3).map((op) => (
                    <div key={op.id} className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-100 hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <img src={op.photoUrl} alt={op.firstName} className="h-10 w-10 rounded-full object-cover bg-slate-100" />
                        <div>
                          <p className="font-semibold text-indigo-950">{op.firstName} {op.lastName}</p>
                          <p className="text-sm text-muted-foreground">{op.code} • {op.vehicle.plate}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          op.status === 'active' ? 'bg-emerald-100 text-emerald-800' :
                          op.status === 'suspended' ? 'bg-red-100 text-red-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {op.status.charAt(0).toUpperCase() + op.status.slice(1)}
                        </span>
                        <Link href={`/portal/operators/${op.id}`}>
                          <Button variant="ghost" size="sm">Details</Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="border-0 shadow-sm bg-indigo-950 text-white">
              <CardHeader>
                <CardTitle className="text-indigo-50">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/portal/operators/new" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <PlusCircle className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Enroll Operator</p>
                    <p className="text-xs text-indigo-300">Add a new driver</p>
                  </div>
                </Link>
                <Link href="/portal/vehicles" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <Car className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Bind Vehicle</p>
                    <p className="text-xs text-indigo-300">Assign to operator</p>
                  </div>
                </Link>
                <Link href="/portal/operators" className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
                  <div className="bg-indigo-500/30 p-2 rounded-md">
                    <Search className="h-5 w-5 text-indigo-200" />
                  </div>
                  <div>
                    <p className="font-medium text-indigo-50">Search Directory</p>
                    <p className="text-xs text-indigo-300">Find by code or name</p>
                  </div>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Recent Incidents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockIncidents.slice(0, 2).map((inc) => (
                    <div key={inc.id} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-start">
                        <p className="font-semibold text-sm text-indigo-950">{inc.type}</p>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                          inc.severity === 'high' ? 'bg-red-100 text-red-800' :
                          inc.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {inc.severity}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">Op: {inc.operatorCode} • {new Date(inc.date).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4 text-sm">View All Incidents</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
