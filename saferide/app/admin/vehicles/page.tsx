'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Filter, Car } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchVehicles } from '@/lib/api/governance';
import type { VehicleListItem } from '@/lib/api/types';
import { toast } from 'sonner';

export default function AdminVehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        setItems(await fetchVehicles());
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Failed to load vehicles');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(({ vehicle, bound_operator, corporate_body_name }) => {
      const plate = (vehicle.external_ref ?? vehicle.display_name ?? '').toLowerCase();
      const name = (bound_operator?.full_name ?? '').toLowerCase();
      const code = (bound_operator?.verify_short_code ?? '').toLowerCase();
      const meta = [
        vehicle.vehicle_type,
        vehicle.make_model,
        vehicle.color,
        corporate_body_name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (
        plate.includes(needle) ||
        name.includes(needle) ||
        code.includes(needle) ||
        meta.includes(needle)
      );
    });
  }, [items, searchTerm]);

  const renderStatus = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE':
      case 'APPROVED':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Active</Badge>;
      case 'SUSPENDED':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Suspended</Badge>;
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="container mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/admin" className="text-sm text-muted-foreground hover:text-indigo-600 flex items-center transition-colors">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950 flex items-center gap-2">
            <Car className="h-8 w-8 text-indigo-600" />
            Vehicles Directory
          </h1>
          <p className="text-muted-foreground mt-1">All registered vehicles and their current driver assignments.</p>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-800">
              All Vehicles
              {!loading && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({items.length})</span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search plate, driver, type, association…"
                  className="pl-8 bg-slate-50 border-slate-200 focus-visible:ring-indigo-600"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="bg-slate-50 border-slate-200 shrink-0">
                <Filter className="h-4 w-4 text-slate-600" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">License Plate</TableHead>
                  <TableHead className="font-semibold text-slate-700">Type</TableHead>
                  <TableHead className="font-semibold text-slate-700">Make &amp; model</TableHead>
                  <TableHead className="font-semibold text-slate-700">Color</TableHead>
                  <TableHead className="font-semibold text-slate-700">Association</TableHead>
                  <TableHead className="font-semibold text-slate-700">Display Name</TableHead>
                  <TableHead className="font-semibold text-slate-700">Assigned Driver</TableHead>
                  <TableHead className="font-semibold text-slate-700">Driver Code</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="font-semibold text-slate-700">Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length > 0 ? (
                  filtered.map(({ vehicle, bound_operator, corporate_body_name }) => (
                    <TableRow key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell className="font-mono font-medium text-indigo-950">
                        {vehicle.external_ref ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{vehicle.vehicle_type ?? '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{vehicle.make_model ?? '—'}</TableCell>
                      <TableCell className="text-sm text-slate-600">{vehicle.color ?? '—'}</TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm text-slate-600">
                        {corporate_body_name ?? '—'}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {vehicle.display_name ?? '—'}
                      </TableCell>
                      <TableCell>
                        {bound_operator ? (
                          <Link
                            href={`/portal/operators/${bound_operator.id}`}
                            className="font-medium text-indigo-600 hover:underline"
                          >
                            {bound_operator.full_name ?? bound_operator.id.slice(0, 8)}
                          </Link>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {bound_operator?.verify_short_code ?? '—'}
                      </TableCell>
                      <TableCell>
                        {bound_operator
                          ? renderStatus(bound_operator.status)
                          : <Badge variant="outline" className="text-slate-400">No driver</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(vehicle.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? 'No vehicles match your search.' : 'No vehicles registered yet.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {!loading && (
            <div className="mt-4 text-sm text-muted-foreground">
              Showing {filtered.length} of {items.length} vehicles
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
