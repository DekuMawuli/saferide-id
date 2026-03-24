'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Car, Plus, Search } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { createVehicle, fetchVehicles } from '@/lib/api/governance';
import type { VehicleRead } from '@/lib/api/types';
import { toast } from 'sonner';

export default function PortalVehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<VehicleRead[]>([]);
  const [loading, setLoading] = useState(true);
  const [plate, setPlate] = useState('');
  const [label, setLabel] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchVehicles();
      setRows(data);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Failed to load vehicles');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = rows.filter((v) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      (v.external_ref ?? '').toLowerCase().includes(q) ||
      (v.display_name ?? '').toLowerCase().includes(q) ||
      v.id.toLowerCase().includes(q)
    );
  });

  const onCreate = async () => {
    if (!plate.trim()) {
      toast.error('Plate / ref is required');
      return;
    }
    try {
      await createVehicle(plate.trim(), label.trim() || null);
      toast.success('Vehicle created');
      setPlate('');
      setLabel('');
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    }
  };

  return (
    <div className="container mx-auto">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4">
            <Link
              href="/portal"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-indigo-600"
            >
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium text-slate-900">Vehicles</span>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-indigo-950">
            <Car className="h-8 w-8 text-indigo-600" />
            Vehicles
          </h1>
          <p className="mt-1 text-muted-foreground">
            <code className="text-xs">GET /vehicles</code> · <code className="text-xs">POST /vehicles</code>
          </p>
        </div>
      </div>

      <Card className="mb-8 border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Add vehicle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Plate / external ref</label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="e.g. UAX 123X" />
          </div>
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Display name (optional)</label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Matatu name" />
          </div>
          <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => void onCreate()}>
            <Plus className="mr-2 h-4 w-4" />
            Create
          </Button>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <CardTitle className="text-lg font-semibold text-slate-800">Fleet registry</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="border-slate-200 bg-slate-50 pl-8"
                placeholder="Search…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Plate / ref</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length ? (
                  filtered.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono font-medium text-indigo-950">
                        {v.external_ref ?? '—'}
                      </TableCell>
                      <TableCell>{v.display_name ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(v.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                      No vehicles yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
