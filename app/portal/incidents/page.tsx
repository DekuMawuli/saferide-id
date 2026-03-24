'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, Filter, MoreHorizontal, AlertTriangle, ArrowLeft, FileText, Eye } from 'lucide-react';
import { mockIncidents, mockOperators } from '@/lib/mock-data';

export default function PortalIncidentsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const filteredIncidents = mockIncidents.filter(incident => {
    const matchesSearch = incident.operatorCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          incident.type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = severityFilter === 'all' || incident.severity === severityFilter;
    return matchesSearch && matchesSeverity;
  });

  const getOperatorName = (code: string) => {
    const op = mockOperators.find(o => o.code === code);
    return op ? `${op.firstName} ${op.lastName}` : 'Unknown Operator';
  };

  const renderSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">High</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Medium</Badge>;
      case 'low':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Low</Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  return (
    <div className="container mx-auto max-w-6xl">
        <div className="mb-6">
          <Link href="/portal" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-indigo-950 flex items-center gap-2">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              Incident Reports
            </h1>
            <p className="text-muted-foreground mt-1">Review and manage safety issues reported against your operators.</p>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Recent Reports</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search code or type..."
                    className="pl-8 bg-slate-50 border-slate-200 focus-visible:ring-indigo-600"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={severityFilter} onValueChange={(val) => setSeverityFilter(val || '')}>
                  <SelectTrigger className="w-[140px] bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
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
                    <TableHead className="font-semibold text-slate-700">Operator</TableHead>
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
                          <div className="flex flex-col">
                            <Link href={`/portal/operators/${incident.operatorCode}`} className="font-medium text-indigo-600 hover:underline">
                              {getOperatorName(incident.operatorCode)}
                            </Link>
                            <span className="text-xs text-muted-foreground font-mono">{incident.operatorCode}</span>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-slate-600">{incident.type.replace('-', ' ')}</TableCell>
                        <TableCell>{renderSeverityBadge(incident.severity)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 capitalize">
                            {incident.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-100">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem>
                                <Eye className="mr-2 h-4 w-4" /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <FileText className="mr-2 h-4 w-4" /> Add Note
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-amber-600">Mark Under Review</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">Suspend Operator</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No incidents found matching your criteria.
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
