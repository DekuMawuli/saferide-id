'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Settings, ShieldCheck, Bell, Building, ArrowLeft, Save } from 'lucide-react';
import { apiFetch, ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

type Health = { status: string; service: string; environment: string; database: string };
type Me = { authenticated: boolean; role: string | null; operator: { full_name: string | null; email?: string | null } | null };

export default function AdminSettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [supportEmail, setSupportEmail] = useState('');
  const [supportPhone, setSupportPhone] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [h, m] = await Promise.all([apiFetch<Health>('/health'), apiFetch<Me>('/auth/me')]);
        setHealth(h);
        setMe(m);
        setSupportEmail(m.operator?.email || '');
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to load settings');
      }
    };
    void load();
  }, []);

  return (
    <div className="container mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950 flex items-center gap-2">
            <Settings className="h-8 w-8 text-indigo-600" />
            System Settings
          </h1>
          <p className="text-muted-foreground mt-1">Configure platform-wide settings, trust policies, and notifications.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <Tabs defaultValue="organization" orientation="vertical" className="w-full flex flex-col gap-2">
              <TabsList className="flex flex-col h-auto bg-transparent items-start space-y-1 p-0">
                <TabsTrigger value="organization" className="w-full justify-start px-4 py-2.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none rounded-lg">
                  <Building className="mr-2 h-4 w-4" /> Organization
                </TabsTrigger>
                <TabsTrigger value="trust" className="w-full justify-start px-4 py-2.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none rounded-lg">
                  <ShieldCheck className="mr-2 h-4 w-4" /> Trust Policy
                </TabsTrigger>
                <TabsTrigger value="notifications" className="w-full justify-start px-4 py-2.5 data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-none rounded-lg">
                  <Bell className="mr-2 h-4 w-4" /> Notifications
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="lg:col-span-3">
            <Tabs defaultValue="organization" className="w-full">
              <TabsContent value="organization" className="mt-0 space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">Organization Profile</CardTitle>
                    <CardDescription>Manage the primary details of the SafeRide platform.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      <div className="grid gap-2">
                        <Label htmlFor="org-name">Organization Name</Label>
                        <Input
                          id="org-name"
                          value={health?.service || 'SafeRide'}
                          onChange={() => {}}
                          className="max-w-md"
                          readOnly
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="support-email">Support Email</Label>
                        <Input
                          id="support-email"
                          type="email"
                          value={supportEmail}
                          onChange={(e) => setSupportEmail(e.target.value)}
                          className="max-w-md"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="support-phone">Emergency Contact Phone</Label>
                        <Input
                          id="support-phone"
                          type="tel"
                          value={supportPhone}
                          onChange={(e) => setSupportPhone(e.target.value)}
                          className="max-w-md"
                          placeholder="+255..."
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Environment</Label>
                        <Input value={health?.environment || 'unknown'} onChange={() => {}} readOnly className="max-w-md" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Database status</Label>
                        <Input value={health?.database || 'unknown'} onChange={() => {}} readOnly className="max-w-md" />
                      </div>
                      <div className="grid gap-2">
                        <Label>Signed in as</Label>
                        <Input
                          value={`${me?.operator?.full_name || 'Unknown'} (${me?.role || '—'})`}
                          onChange={() => {}}
                          readOnly
                          className="max-w-md"
                        />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Save className="mr-2 h-4 w-4" /> Save Changes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="trust" className="mt-0 space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">Trust & Verification Policy</CardTitle>
                    <CardDescription>Configure rules for operator verification and suspension.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold text-slate-900">Require Biometric Consent</Label>
                          <p className="text-sm text-muted-foreground">Operators must approve data sharing via their device before passengers can view their details.</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold text-slate-900">Auto-Suspend on High Severity Incident</Label>
                          <p className="text-sm text-muted-foreground">Automatically change operator status to &apos;Suspended&apos; when a high-severity incident is reported.</p>
                        </div>
                        <Switch defaultChecked />
                      </div>

                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold text-slate-900">Annual Re-verification</Label>
                          <p className="text-sm text-muted-foreground">Require operators to renew their credentials every 12 months.</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Save className="mr-2 h-4 w-4" /> Save Policies
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications" className="mt-0 space-y-6">
                <Card className="border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-xl">Notification Settings</CardTitle>
                    <CardDescription>Manage automated alerts sent to admins and officers.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold text-slate-900">Incident Alerts (High Severity)</Label>
                          <p className="text-sm text-muted-foreground">Send immediate SMS/Email to admins when a high-severity incident is logged.</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg bg-slate-50">
                        <div className="space-y-0.5">
                          <Label className="text-base font-semibold text-slate-900">Daily Digest</Label>
                          <p className="text-sm text-muted-foreground">Send a daily summary of verifications and new enrollments to association officers.</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                    </div>
                    <div className="pt-4 border-t border-slate-100 flex justify-end">
                      <Button className="bg-indigo-600 hover:bg-indigo-700">
                        <Save className="mr-2 h-4 w-4" /> Save Preferences
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
  );
}
