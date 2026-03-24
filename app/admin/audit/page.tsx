'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Filter, Download, Activity } from 'lucide-react';

// Mock Audit Log Data
const mockAuditLogs = [
  { id: 'AL-1001', date: '2023-11-15T09:30:00Z', action: 'operator_enrolled', actor: 'Officer Jane Doe', target: 'OP-10234', details: 'New operator enrolled successfully.' },
  { id: 'AL-1002', date: '2023-11-15T10:15:00Z', action: 'vehicle_bound', actor: 'Officer Jane Doe', target: 'UAB 123C', details: 'Vehicle bound to operator OP-10234.' },
  { id: 'AL-1003', date: '2023-11-14T14:20:00Z', action: 'status_changed', actor: 'Admin System', target: 'OP-09876', details: 'Status changed from active to suspended due to incident report.' },
  { id: 'AL-1004', date: '2023-11-14T16:45:00Z', action: 'incident_resolved', actor: 'Admin John Smith', target: 'INC-2023-001', details: 'Incident marked as resolved after investigation.' },
  { id: 'AL-1005', date: '2023-11-13T08:00:00Z', action: 'login_failed', actor: 'Unknown IP', target: 'System', details: 'Multiple failed login attempts detected.' },
  { id: 'AL-1006', date: '2023-11-12T11:10:00Z', action: 'operator_updated', actor: 'Officer Mark Lee', target: 'OP-11223', details: 'Updated operator contact information.' },
];

export default function AdminAuditLogPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = mockAuditLogs.filter(log => 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.target.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderActionBadge = (action: string) => {
    if (action.includes('enrolled') || action.includes('resolved') || action.includes('bound')) {
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">{action.replace('_', ' ')}</Badge>;
    }
    if (action.includes('failed') || action.includes('suspended')) {
      return <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200">{action.replace('_', ' ')}</Badge>;
    }
    return <Badge variant="secondary" className="bg-slate-100 text-slate-800 hover:bg-slate-100 border-slate-200">{action.replace('_', ' ')}</Badge>;
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
              <Activity className="h-8 w-8 text-indigo-600" />
              System Audit Log
            </h1>
            <p className="text-muted-foreground mt-1">Track all administrative actions and system events.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="bg-white">
              <Download className="mr-2 h-4 w-4" />
              Export Logs
            </Button>
          </div>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="text-lg font-semibold text-slate-800">Recent Activity</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search action, actor, or target..."
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
                    <TableHead className="font-semibold text-slate-700">Timestamp</TableHead>
                    <TableHead className="font-semibold text-slate-700">Action</TableHead>
                    <TableHead className="font-semibold text-slate-700">Actor</TableHead>
                    <TableHead className="font-semibold text-slate-700">Target</TableHead>
                    <TableHead className="font-semibold text-slate-700">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length > 0 ? (
                    filteredLogs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                          {new Date(log.date).toLocaleString()}
                        </TableCell>
                        <TableCell className="capitalize">{renderActionBadge(log.action)}</TableCell>
                        <TableCell className="text-sm font-medium text-slate-700">{log.actor}</TableCell>
                        <TableCell className="font-mono text-sm text-indigo-600">{log.target}</TableCell>
                        <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={log.details}>
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        No logs found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
              <div>Showing {filteredLogs.length} of {mockAuditLogs.length} logs</div>
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
