'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Car, Pencil, Plus, Search } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { createVehicle, fetchCorporateBodies, fetchVehicles, updateVehicle } from '@/lib/api/governance';
import type { CorporateBodyRead, VehicleListItem } from '@/lib/api/types';
import { useOperatorSession } from '@/hooks/use-operator-session';
import { toast } from 'sonner';

const VEHICLE_TYPES = ['Motorcycle', 'Matatu', 'Sedan', 'Taxi', 'Van', 'Boda', 'Pickup', 'Other'] as const;

function isPlatformAdminRole(role: string | null | undefined): boolean {
  const r = (role ?? '').toLowerCase();
  return r === 'admin' || r === 'system_admin';
}

/** Matches backend `_can_edit_vehicle`: admins, monitor, support, or officer in same association. */
function canEditVehicleRow(
  role: string | null | undefined,
  vehicleCorporateBodyId: string | null | undefined,
  operatorCorporateBodyId: string | null | undefined,
): boolean {
  const r = (role ?? '').toLowerCase();
  if (['admin', 'system_admin', 'monitor', 'support'].includes(r)) return true;
  if (r === 'officer') {
    // Officers can edit vehicles in their association and legacy rows with no association yet.
    if (!operatorCorporateBodyId) return false;
    return !vehicleCorporateBodyId || operatorCorporateBodyId === vehicleCorporateBodyId;
  }
  return false;
}

export default function PortalVehiclesPage() {
  const { me } = useOperatorSession();
  const operatorRole = me?.operator?.role;
  const isPlatformAdmin = isPlatformAdminRole(operatorRole);
  const [searchTerm, setSearchTerm] = useState('');
  const [rows, setRows] = useState<VehicleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [associationLabel, setAssociationLabel] = useState<string | null>(null);
  const [corporateBodies, setCorporateBodies] = useState<CorporateBodyRead[]>([]);

  const [plate, setPlate] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [vehicleType, setVehicleType] = useState<string>('');
  const [makeModel, setMakeModel] = useState('');
  const [color, setColor] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editVehicleType, setEditVehicleType] = useState('');
  const [editMakeModel, setEditMakeModel] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editCorporateBodyId, setEditCorporateBodyId] = useState<string | null>(null);

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

  useEffect(() => {
    const id = me?.operator?.corporate_body_id;
    if (!id) {
      setAssociationLabel(null);
      return;
    }
    void fetchCorporateBodies()
      .then((list) => {
        const c = list.find((x) => x.id === id);
        setAssociationLabel(c?.name ?? null);
      })
      .catch(() => setAssociationLabel(null));
  }, [me?.operator?.corporate_body_id]);

  useEffect(() => {
    if (!isPlatformAdmin) {
      setCorporateBodies([]);
      return;
    }
    void fetchCorporateBodies()
      .then(setCorporateBodies)
      .catch(() => setCorporateBodies([]));
  }, [isPlatformAdmin]);

  const filtered = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(({ vehicle: v, corporate_body_name: cn }) => {
      const blob = [
        v.external_ref,
        v.display_name,
        v.vehicle_type,
        v.make_model,
        v.color,
        v.id,
        cn,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, searchTerm]);

  const resetForm = () => {
    setPlate('');
    setDisplayName('');
    setVehicleType('');
    setMakeModel('');
    setColor('');
  };

  const onCreate = async () => {
    if (!plate.trim()) {
      toast.error('License plate is required');
      return;
    }
    setCreating(true);
    try {
      await createVehicle({
        plate: plate.trim(),
        display_name: displayName.trim() || null,
        vehicle_type: vehicleType.trim() || null,
        make_model: makeModel.trim() || null,
        color: color.trim() || null,
      });
      toast.success('Vehicle created');
      setModalOpen(false);
      resetForm();
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (row: VehicleListItem) => {
    const v = row.vehicle;
    setEditId(v.id);
    setEditPlate(v.external_ref ?? '');
    setEditDisplayName(v.display_name ?? '');
    setEditVehicleType(v.vehicle_type ?? '');
    setEditMakeModel(v.make_model ?? '');
    setEditColor(v.color ?? '');
    setEditCorporateBodyId(v.corporate_body_id ?? null);
    setEditOpen(true);
  };

  const resetEdit = () => {
    setEditId(null);
    setEditPlate('');
    setEditDisplayName('');
    setEditVehicleType('');
    setEditMakeModel('');
    setEditColor('');
    setEditCorporateBodyId(null);
  };

  const onSaveEdit = async () => {
    if (!editId || !editPlate.trim()) {
      toast.error('License plate is required');
      return;
    }
    setEditSaving(true);
    try {
      await updateVehicle(editId, {
        plate: editPlate.trim(),
        display_name: editDisplayName.trim() || null,
        vehicle_type: editVehicleType.trim() || null,
        make_model: editMakeModel.trim() || null,
        color: editColor.trim() || null,
        ...(isPlatformAdmin ? { corporate_body_id: editCorporateBodyId } : {}),
      });
      toast.success('Vehicle updated');
      setEditOpen(false);
      resetEdit();
      void load();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setEditSaving(false);
    }
  };

  const editTypeOptions = useMemo(() => {
    const t = editVehicleType.trim();
    const base = [...VEHICLE_TYPES];
    if (t && !base.includes(t as (typeof VEHICLE_TYPES)[number])) {
      base.push(t as (typeof VEHICLE_TYPES)[number]);
    }
    return base;
  }, [editVehicleType]);

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
          <p className="mt-1 text-muted-foreground">Register fleet vehicles and bind them to riders or drivers.</p>
        </div>
        <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" onClick={() => setModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add vehicle
        </Button>
      </div>

      <Dialog open={modalOpen} onOpenChange={(o) => { setModalOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add vehicle</DialogTitle>
            <DialogDescription>
              Enter license plate and vehicle details. New registrations are tied to your association.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {associationLabel ? (
              <p className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-900">
                <span className="font-medium">Association: </span>
                {associationLabel}
              </p>
            ) : me?.operator?.corporate_body_id ? (
              <p className="text-xs text-muted-foreground">Loading association…</p>
            ) : (
              <p className="text-xs text-amber-800">
                Your account is not linked to a corporate body. Contact an administrator.
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="plate">License plate</Label>
              <Input
                id="plate"
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                placeholder="e.g. UAB 123C"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vtype">Vehicle type</Label>
              <Select value={vehicleType || undefined} onValueChange={(v) => setVehicleType(v ?? '')}>
                <SelectTrigger id="vtype" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="makemodel">Make &amp; model</Label>
              <Input
                id="makemodel"
                value={makeModel}
                onChange={(e) => setMakeModel(e.target.value)}
                placeholder="e.g. Bajaj Boxer"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="e.g. Red"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dname">Display name (optional)</Label>
              <Input
                id="dname"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Friendly label in lists"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" className="bg-indigo-600 hover:bg-indigo-700" disabled={creating} onClick={() => void onCreate()}>
              {creating ? 'Saving…' : 'Create vehicle'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) resetEdit();
        }}
      >
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit vehicle</DialogTitle>
            <DialogDescription>Update plate, details, or association (admins only for association).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            {isPlatformAdmin ? (
              <div className="space-y-2">
                <Label htmlFor="edit-corp">Association</Label>
                <Select
                  value={editCorporateBodyId ?? 'none'}
                  onValueChange={(v) => setEditCorporateBodyId(v === 'none' ? null : v)}
                >
                  <SelectTrigger id="edit-corp" className="w-full">
                    <SelectValue placeholder="Select association" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {corporateBodies.map((cb) => (
                      <SelectItem key={cb.id} value={cb.id}>
                        {cb.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : associationLabel ? (
              <p className="rounded-lg border border-indigo-100 bg-indigo-50/80 px-3 py-2 text-sm text-indigo-900">
                <span className="font-medium">Association: </span>
                {associationLabel}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="edit-plate">License plate</Label>
              <Input
                id="edit-plate"
                value={editPlate}
                onChange={(e) => setEditPlate(e.target.value)}
                placeholder="e.g. UAB 123C"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-vtype">Vehicle type</Label>
              <Select value={editVehicleType || undefined} onValueChange={(v) => setEditVehicleType(v ?? '')}>
                <SelectTrigger id="edit-vtype" className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {editTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-makemodel">Make &amp; model</Label>
              <Input
                id="edit-makemodel"
                value={editMakeModel}
                onChange={(e) => setEditMakeModel(e.target.value)}
                placeholder="e.g. Bajaj Boxer"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-color">Color</Label>
              <Input
                id="edit-color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                placeholder="e.g. Red"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-dname">Display name (optional)</Label>
              <Input
                id="edit-dname"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                placeholder="Friendly label in lists"
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-indigo-600 hover:bg-indigo-700"
              disabled={editSaving}
              onClick={() => void onSaveEdit()}
            >
              {editSaving ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <CardTitle className="text-lg font-semibold text-slate-800">Fleet registry</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="border-slate-200 bg-slate-50 pl-8"
                placeholder="Search plate, type, association…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Plate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Make &amp; model</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Association</TableHead>
                  <TableHead>Display name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length ? (
                  filtered.map((row) => {
                    const { vehicle: v, corporate_body_name: cn } = row;
                    const canEditRow = canEditVehicleRow(
                      operatorRole,
                      v.corporate_body_id,
                      me?.operator?.corporate_body_id,
                    );
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-medium text-indigo-950 whitespace-nowrap">
                          {v.external_ref ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm">{v.vehicle_type ?? '—'}</TableCell>
                        <TableCell className="text-sm">{v.make_model ?? '—'}</TableCell>
                        <TableCell className="text-sm">{v.color ?? '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-slate-700">{cn ?? '—'}</TableCell>
                        <TableCell className="text-sm">{v.display_name ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEditRow ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-indigo-700 hover:text-indigo-900"
                              onClick={() => openEdit(row)}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Edit
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
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
