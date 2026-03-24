'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Car, FileText, QrCode } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import {
  bindVehicleToOperator,
  fetchOperatorProfile,
  fetchOperatorVehicleBindings,
  fetchVehicles,
  patchBindingActive,
  patchOperatorStatus,
} from '@/lib/api/governance';
import { getPublicAppOrigin } from '@/lib/app-url';
import type { OperatorRead, OperatorVehicleBindingListItem, VehicleRead } from '@/lib/api/types';
import { toast } from 'sonner';

function statusBadge(status: string) {
  const s = status.toUpperCase();
  if (s === 'ACTIVE') {
    return <Badge className="bg-emerald-600 hover:bg-emerald-700">ACTIVE</Badge>;
  }
  if (s === 'APPROVED') {
    return <Badge className="bg-teal-600 hover:bg-teal-700">APPROVED</Badge>;
  }
  if (s === 'PENDING') {
    return <Badge variant="secondary">PENDING</Badge>;
  }
  if (s === 'SUSPENDED') {
    return <Badge variant="destructive">SUSPENDED</Badge>;
  }
  if (s === 'EXPIRED') {
    return <Badge variant="outline">EXPIRED</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export default function OperatorDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const operatorId = resolvedParams.id;
  const [loading, setLoading] = useState(true);
  const [operator, setOperator] = useState<OperatorRead | null>(null);
  const [bindings, setBindings] = useState<OperatorVehicleBindingListItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRead[]>([]);
  const [vehiclePick, setVehiclePick] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [op, binds, vehs] = await Promise.all([
        fetchOperatorProfile(operatorId),
        fetchOperatorVehicleBindings(operatorId),
        fetchVehicles(),
      ]);
      setOperator(op);
      setBindings(binds);
      setVehicles(vehs);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load operator');
      setOperator(null);
    } finally {
      setLoading(false);
    }
  }, [operatorId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const verifyUrl =
    operator?.verify_short_code && getPublicAppOrigin()
      ? `${getPublicAppOrigin()}/verify/result/${operator.verify_short_code}`
      : '';

  const onStatus = async (status: string) => {
    try {
      const op = await patchOperatorStatus(operatorId, status);
      setOperator(op);
      toast.success(`Status → ${status}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    }
  };

  const onBind = async () => {
    if (!vehiclePick) {
      toast.error('Select a vehicle');
      return;
    }
    try {
      await bindVehicleToOperator(operatorId, vehiclePick);
      toast.success('Vehicle bound');
      setVehiclePick('');
      void refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Bind failed');
    }
  };

  const onUnbind = async (bindingId: string) => {
    try {
      await patchBindingActive(bindingId, false);
      toast.success('Binding deactivated');
      void refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Unbind failed');
    }
  };

  const primary = bindings.find((b) => b.binding.is_active);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <main className="container mx-auto flex-1 px-4 py-8 md:py-12">
        <div className="mb-6">
          <Link
            href="/portal/operators"
            className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Operators
          </Link>
        </div>

        {loading ? (
          <div className="space-y-6">
            <Skeleton className="h-12 w-64" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <Skeleton className="h-[400px] md:col-span-1" />
              <Skeleton className="h-[400px] md:col-span-2" />
            </div>
          </div>
        ) : operator ? (
          <div className="animate-in fade-in space-y-6 duration-500">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:gap-4">
                <h1 className="text-3xl font-bold text-indigo-950">
                  {operator.full_name?.trim() || 'Operator'}
                </h1>
                {statusBadge(operator.status)}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void onStatus('APPROVED')}>
                  Approve
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => void onStatus('ACTIVE')}>
                  Set active
                </Button>
                <Button size="sm" variant="destructive" onClick={() => void onStatus('SUSPENDED')}>
                  Suspend
                </Button>
                <Button size="sm" variant="outline" onClick={() => void onStatus('EXPIRED')}>
                  Mark expired
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void onStatus('PENDING')}>
                  Reset pending
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
              <div className="space-y-6 lg:col-span-1">
                <Card className="overflow-hidden border-0 shadow-sm">
                  <div
                    className={`h-2 ${
                      operator.status === 'ACTIVE'
                        ? 'bg-emerald-500'
                        : operator.status === 'SUSPENDED'
                          ? 'bg-red-500'
                          : 'bg-amber-500'
                    }`}
                  />
                  <CardContent className="flex flex-col items-center space-y-4 p-6 text-center">
                    <div className="h-40 w-40 overflow-hidden rounded-full border-4 border-slate-100 bg-slate-100 shadow-sm">
                      {operator.photo_ref ? (
                        <img src={operator.photo_ref} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-indigo-950">
                        {operator.full_name?.trim() || '—'}
                      </h2>
                      <p className="text-muted-foreground text-sm">{operator.phone ?? '—'}</p>
                    </div>
                    <div className="w-full border-t pt-4">
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                        <div className="mb-2 flex items-center justify-center gap-2 text-indigo-950">
                          <QrCode className="h-5 w-5" />
                          <span className="text-sm font-medium">Passenger verify</span>
                        </div>
                        {verifyUrl ? (
                          <div className="flex flex-col items-center gap-2">
                            <div className="rounded-lg bg-white p-2">
                              <QRCodeSVG value={verifyUrl} size={160} level="M" />
                            </div>
                            <p className="font-mono text-lg font-bold tracking-widest text-indigo-900">
                              {operator.verify_short_code}
                            </p>
                          </div>
                        ) : (
                          <p className="text-muted-foreground text-sm">
                            Short code appears after status is APPROVED or ACTIVE.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-2">
                <Card className="h-full border-0 shadow-sm">
                  <Tabs defaultValue="details" className="w-full">
                    <CardHeader className="border-b bg-slate-50/50 pb-0">
                      <TabsList className="h-auto w-full justify-start border-b-0 bg-transparent p-0">
                        <TabsTrigger
                          value="details"
                          className="rounded-none px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none"
                        >
                          Identity & vehicle
                        </TabsTrigger>
                        <TabsTrigger
                          value="bind"
                          className="rounded-none px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none"
                        >
                          Bind vehicle
                        </TabsTrigger>
                      </TabsList>
                    </CardHeader>
                    <CardContent className="p-6">
                      <TabsContent value="details" className="mt-0 space-y-8">
                        <div>
                          <h3 className="mb-4 flex items-center text-lg font-semibold text-indigo-950">
                            <FileText className="mr-2 h-5 w-5 text-indigo-500" />
                            Identity
                          </h3>
                          <dl className="grid grid-cols-1 gap-y-4 sm:grid-cols-2 sm:gap-x-4">
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Operator ID</dt>
                              <dd className="mt-1 font-mono text-sm text-slate-900">{operator.id}</dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">eSignet subject</dt>
                              <dd className="mt-1 break-all text-sm text-slate-900">
                                {operator.external_subject_id}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Last IdP sync</dt>
                              <dd className="mt-1 text-sm text-slate-900">
                                {operator.esignet_verified_at
                                  ? new Date(operator.esignet_verified_at).toLocaleString()
                                  : '—'}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        <div className="border-t pt-8">
                          <h3 className="mb-4 flex items-center text-lg font-semibold text-indigo-950">
                            <Car className="mr-2 h-5 w-5 text-indigo-500" />
                            Bound vehicles
                          </h3>
                          {bindings.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No bindings yet.</p>
                          ) : (
                            <ul className="space-y-2">
                              {bindings.map((b) => (
                                <li
                                  key={b.binding.id}
                                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
                                >
                                  <div>
                                    <p className="font-mono font-semibold text-indigo-950">
                                      {b.plate ?? b.vehicle_display_name ?? b.binding.vehicle_id}
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                      {b.binding.is_active ? 'Active' : 'Inactive'} · {b.binding.id}
                                    </p>
                                  </div>
                                  {b.binding.is_active ? (
                                    <Button size="sm" variant="outline" onClick={() => void onUnbind(b.binding.id)}>
                                      Unbind
                                    </Button>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          )}
                          {primary ? (
                            <p className="text-muted-foreground mt-4 text-sm">
                              Primary active plate:{' '}
                              <span className="font-mono font-medium text-slate-800">
                                {primary.plate ?? primary.vehicle_display_name}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      </TabsContent>

                      <TabsContent value="bind" className="mt-0 space-y-4">
                        <CardDescription>
                          Register vehicles under <Link href="/portal/vehicles">Vehicles</Link> if needed, then bind
                          here.
                        </CardDescription>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                          <div className="flex-1 space-y-2">
                            <label className="text-sm font-medium">Vehicle</label>
                            <Select
                              value={vehiclePick}
                              onValueChange={(v) => setVehiclePick(v ?? '')}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select plate…" />
                              </SelectTrigger>
                              <SelectContent>
                                {vehicles.map((v) => (
                                  <SelectItem key={v.id} value={v.id}>
                                    {v.external_ref ?? v.display_name ?? v.id}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" onClick={() => void onBind()}>
                            Bind to operator
                          </Button>
                        </div>
                      </TabsContent>
                    </CardContent>
                  </Tabs>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center">
            <h2 className="text-2xl font-bold text-slate-900">Operator not found</h2>
            <p className="text-muted-foreground mt-2">Check the ID or your permissions.</p>
            <Link href="/portal/operators" className="mt-4 inline-block">
              <Button>Back to directory</Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
