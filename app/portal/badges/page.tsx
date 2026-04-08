'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Combobox } from '@/components/ui/combobox';
import { QrCode, Printer, Download, RefreshCw, Search, ArrowLeft, ShieldCheck } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { fetchOperatorsList } from '@/lib/api/governance';
import type { OperatorListItem } from '@/lib/api/types';
import { toast } from 'sonner';

export default function BadgeGenerationPage() {
  const [rows, setRows] = useState<OperatorListItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const data = await fetchOperatorsList({ limit: 500 });
        const active = data.filter((o) => {
          const statusOk = ['ACTIVE', 'APPROVED'].includes(o.operator.status.toUpperCase());
          const role = (o.operator.role || '').toLowerCase();
          const roleOk = role === 'driver' || role === 'passenger';
          return statusOk && roleOk;
        });
        setRows(active);
      } catch (e) {
        toast.error(e instanceof ApiError ? `${e.status}: ${e.message}` : 'Failed to load operators');
      }
    })();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const q = searchTerm.toLowerCase().trim();
        if (!q) return true;
        const op = r.operator;
        return (
          (op.full_name || '').toLowerCase().includes(q) ||
          (op.verify_short_code || '').toLowerCase().includes(q) ||
          (r.primary_vehicle_plate || '').toLowerCase().includes(q)
        );
      }),
    [rows, searchTerm],
  );

  const selected = rows.find((r) => r.operator.id === selectedOperatorId) || null;
  const selectedOperator = selected?.operator || null;

  const handleRegenerate = () => {
    setIsGenerating(true);
    setTimeout(() => setIsGenerating(false), 1500);
  };

  return (
    <div className="container mx-auto max-w-5xl">
        <div className="mb-6">
          <Link href="/portal" className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-indigo-950">Badge Generation</h1>
          <p className="text-muted-foreground mt-1">Create, review, and print official SafeRide credentials for riders/drivers only.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Selector & Controls */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Select Rider / Driver</CardTitle>
                <CardDescription>Choose an active rider/driver to generate their badge (officers/staff are excluded).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Search Rider / Driver</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Name or Code..."
                      className="pl-8"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                
                <Combobox
                  label="Select from List"
                  searchPlaceholder="Filter current results..."
                  emptyText="No rider/driver matches."
                  items={filtered.map((r) => ({
                    id: r.operator.id,
                    label: `${r.operator.full_name || 'Unnamed'} (${r.operator.verify_short_code || '—'})`,
                    searchText: `${r.operator.full_name || ''} ${r.operator.verify_short_code || ''} ${r.primary_vehicle_plate || ''}`,
                  }))}
                  value={selectedOperatorId}
                  onChange={setSelectedOperatorId}
                />

                <div className="pt-4 mt-4 border-t border-slate-100">
                  {selectedOperator ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                        {selectedOperator.photo_ref ? (
                          <img src={selectedOperator.photo_ref} alt="Selected" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-slate-900">{selectedOperator.full_name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{selected?.primary_vehicle_plate || '—'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-muted-foreground">
                      Nothing selected yet.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Badge Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={handleRegenerate}
                  disabled={isGenerating || !selectedOperator}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" /> Regenerate Codes
                    </span>
                  )}
                </Button>
                <Button variant="outline" className="w-full border-slate-300">
                  <Download className="mr-2 h-4 w-4" /> Download PDF
                </Button>
                <Button variant="outline" className="w-full border-slate-300">
                  <Printer className="mr-2 h-4 w-4" /> Print Badge
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Badge Preview */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Official Badge Preview
            </h2>
            
            <div className="bg-slate-200 p-8 rounded-xl flex items-center justify-center min-h-[500px] border border-slate-300">
              {!selectedOperator ? (
                <div className="text-sm text-slate-600">Select a rider/driver to preview badge.</div>
              ) : (
              <div className="w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden relative transition-all duration-500" style={{ opacity: isGenerating ? 0.5 : 1 }}>
                {/* Header */}
                <div className="bg-indigo-950 p-4 text-center text-white">
                  <h3 className="font-bold text-lg tracking-wider">SafeRide</h3>
                  <p className="text-xs text-indigo-200 uppercase tracking-widest mt-1">Verified Rider/Driver</p>
                </div>
                
                {/* Photo & Basic Info */}
                <div className="p-6 flex flex-col items-center border-b border-slate-100">
                  <div className="h-32 w-32 rounded-full border-4 border-white shadow-md overflow-hidden mb-4 bg-slate-100 relative z-10 -mt-12">
                    {selectedOperator?.photo_ref ? (
                      <img src={selectedOperator.photo_ref} alt="Operator" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 text-center">{selectedOperator?.full_name || '—'}</h2>
                  <p className="text-sm font-medium text-indigo-600 mt-1">SafeRide Verified</p>
                </div>
                
                {/* QR & Codes */}
                <div className="p-6 bg-slate-50 flex flex-col items-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Scan to Verify</p>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-4">
                    <QrCode className="h-32 w-32 text-indigo-950" />
                  </div>
                  
                  <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Manual Entry Code</p>
                    <p className="text-2xl font-mono font-bold tracking-[0.2em] text-slate-900">{selectedOperator?.verify_short_code || '—'}</p>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="bg-slate-900 p-3 text-center">
                  <p className="text-[10px] text-slate-400">Property of SafeRide Trust Network. If found, please return to nearest authority.</p>
                </div>
              </div>
              )}
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
              <strong>Printing Instructions:</strong> For best results, print on PVC CR80 cards using a specialized ID card printer. Ensure the QR code is printed clearly without smudges for reliable scanning.
            </div>
          </div>
        </div>
      </div>
  );
}
