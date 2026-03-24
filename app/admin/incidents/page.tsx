'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, Search, MoreHorizontal, Filter, Download, AlertOctagon } from 'lucide-react';
import { mockIncidents } from '@/lib/mock-data';

export default function AdminIncidentsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIncidents = mockIncidents.filter(incident => 
    incident.operatorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
    incident.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">Open</Badge>;
      case 'investigating':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Investigating</Badge>;
      case 'resolved':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">Resolved</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive" className="bg-red-600 text-white hover:bg-red-700">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-500 text-white hover:bg-amber-600">Medium</Badge>;
      case 'low':
        return <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
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
              <AlertOctagon className="h-8 w-8 text-indigo-600" />
              Incident Reports
            </h1>
            <p className="text-muted-foreground mt-1">Review and manage reported issues across the platform.</p>
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
              <CardTitle className="text-lg font-semibold text-slate-800">All Incidents</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search ID, type, or status..."
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
                    <TableHead className="font-semibold text-slate-700">ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Date</TableHead>
                    <TableHead className="font-semibold text-slate-700">Operator ID</TableHead>
                    <TableHead className="font-semibold text-slate-700">Type</TableHead>
                    <TableHead className="font-semibold text-slate-700">Severity</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncidents.length > 0 ? (
                    filteredIncidents.map((incident) => (
                      <TableRow key={incident.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-mono font-medium text-indigo-950">{incident.id}</TableCell>
                        <TableCell className="text-sm text-slate-600">{new Date(incident.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Link href={`/admin/operators/${incident.operatorCode}`} className="font-medium text-indigo-600 hover:underline">
                            {incident.operatorCode}
                          </Link>
                        </TableCell>
                        <TableCell className="capitalize text-slate-600">{incident.type.replace('-', ' ')}</TableCell>
                        <TableCell>{renderSeverityBadge(incident.severity)}</TableCell>
                        <TableCell>{renderStatusBadge(incident.status)}</TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>View Details</DropdownMenuItem>
                              <DropdownMenuItem>Update Status</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">Escalate</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No incidents found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Showing {filteredIncidents.length} of {mockIncidents.length} incidents</div>
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
