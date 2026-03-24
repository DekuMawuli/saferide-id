'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Search, MoreHorizontal, Filter, Download, Car } from 'lucide-react';
import { mockOperators } from '@/lib/mock-data';

export default function AdminVehiclesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // Extract unique vehicles from mock operators for the table
  const vehicles = mockOperators.map(op => ({
    ...op.vehicle,
    operatorName: `${op.firstName} ${op.lastName}`,
    operatorId: op.id,
    association: op.association,
    status: op.status
  }));

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.operatorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <p className="text-muted-foreground mt-1">Manage and monitor all registered vehicles on the platform.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-slate-800">All Vehicles</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search plate or operator..."
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
                    <TableHead className="font-semibold text-slate-700">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700">Assigned Operator</TableHead>
                    <TableHead className="font-semibold text-slate-700">Association</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.length > 0 ? (
                    filteredVehicles.map((vehicle) => (
                      <TableRow key={vehicle.plate} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono font-medium text-indigo-950">{vehicle.plate}</TableCell>
                        <TableCell className="capitalize text-slate-600">{vehicle.category}</TableCell>
                        <TableCell>
                          <Link href={`/admin/operators/${vehicle.operatorId}`} className="font-medium text-indigo-600 hover:underline">
                            {vehicle.operatorName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">{vehicle.association}</TableCell>
                        <TableCell>{renderStatusBadge(vehicle.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>View Vehicle Details</DropdownMenuItem>
                              <DropdownMenuItem>View Operator</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Flag Vehicle</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No vehicles found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Showing {filteredVehicles.length} of {vehicles.length} vehicles</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>Previous</Button>
                <Button variant="outline" size="sm" disabled>Next</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
  );
}
