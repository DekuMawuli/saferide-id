'use client';

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Car, ShieldAlert, Activity, ArrowRight, FileText, Settings } from 'lucide-react';
import { mockOperators, mockIncidents } from '@/lib/mock-data';

export default function AdminDashboard() {
  const totalOperators = mockOperators.length;
  const activeOperators = mockOperators.filter(op => op.status === 'active').length;
  const suspendedOperators = mockOperators.filter(op => op.status === 'suspended').length;
  const totalIncidents = mockIncidents.length;

  return (
    <div className="flex flex-col">
      
      <main className="flex-1 container mx-auto px-4 py-8 md:py-12">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-indigo-950">System Administration</h1>
            <p className="text-muted-foreground">Platform-level monitoring and control.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Operators</CardTitle>
              <Users className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{totalOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all associations
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Profiles</CardTitle>
              <Activity className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{activeOperators}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Currently verified
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
                Pending review
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Incidents</CardTitle>
              <FileText className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-indigo-950">{totalIncidents}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Reported by passengers
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Operator Directory</CardTitle>
                <CardDescription>Manage all registered operators.</CardDescription>
              </div>
              <Link href="/admin/operators">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockOperators.slice(0, 4).map((op) => (
                  <div key={op.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${
                        op.status === 'active' ? 'bg-emerald-500' :
                        op.status === 'suspended' ? 'bg-red-500' :
                        'bg-amber-500'
                      }`} />
                      <div>
                        <p className="font-medium text-sm text-indigo-950">{op.firstName} {op.lastName}</p>
                        <p className="text-xs text-muted-foreground">{op.code} • {op.association}</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 text-xs">Manage</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Incident Reports</CardTitle>
                <CardDescription>Recent issues flagged by passengers.</CardDescription>
              </div>
              <Link href="/admin/incidents">
                <Button variant="ghost" size="sm" className="text-indigo-600">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockIncidents.map((inc) => (
                  <div key={inc.id} className="flex flex-col gap-2 p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm text-indigo-950">{inc.type}</p>
                        <p className="text-xs text-muted-foreground">Operator: {inc.operatorCode}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${
                        inc.severity === 'high' ? 'bg-red-100 text-red-800' :
                        inc.severity === 'medium' ? 'bg-amber-100 text-amber-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {inc.severity}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 line-clamp-2">{inc.note}</p>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200">
                      <span className="text-xs text-muted-foreground">{new Date(inc.date).toLocaleDateString()}</span>
                      <Button variant="outline" size="sm" className="h-7 text-xs">Review</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
