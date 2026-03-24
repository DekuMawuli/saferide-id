'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { QrCode, Printer, Download, RefreshCw, Search, ArrowLeft, ShieldCheck } from 'lucide-react';
import { mockOperators } from '@/lib/mock-data';

export default function BadgeGenerationPage() {
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(mockOperators[0].id);
  const [isGenerating, setIsGenerating] = useState(false);

  const selectedOperator = mockOperators.find(op => op.id === selectedOperatorId) || mockOperators[0];

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
          <p className="text-muted-foreground mt-1">Create, review, and print official SafeRide credentials for your operators.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Selector & Controls */}
          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Select Operator</CardTitle>
                <CardDescription>Choose an active operator to generate their badge.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Search Operator</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Name or Code..." className="pl-8" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Select from List</label>
                  <Select value={selectedOperatorId} onValueChange={(val) => setSelectedOperatorId(val || '')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      {mockOperators.filter(op => op.status === 'active').map(op => (
                        <SelectItem key={op.id} value={op.id}>
                          {op.firstName} {op.lastName} ({op.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100">
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="h-10 w-10 rounded-full overflow-hidden bg-slate-200 shrink-0">
                      <img src={selectedOperator.photoUrl} alt="Selected" className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="font-medium text-sm text-slate-900">{selectedOperator.firstName} {selectedOperator.lastName}</p>
                      <p className="text-xs text-muted-foreground">{selectedOperator.vehicle.plate}</p>
                    </div>
                  </div>
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
                  disabled={isGenerating}
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
              {/* The Physical Badge Mockup */}
              <div className="w-[320px] bg-white rounded-2xl shadow-xl overflow-hidden relative transition-all duration-500" style={{ opacity: isGenerating ? 0.5 : 1 }}>
                {/* Header */}
                <div className="bg-indigo-950 p-4 text-center text-white">
                  <h3 className="font-bold text-lg tracking-wider">SafeRide</h3>
                  <p className="text-xs text-indigo-200 uppercase tracking-widest mt-1">Verified Operator</p>
                </div>
                
                {/* Photo & Basic Info */}
                <div className="p-6 flex flex-col items-center border-b border-slate-100">
                  <div className="h-32 w-32 rounded-full border-4 border-white shadow-md overflow-hidden mb-4 bg-slate-100 relative z-10 -mt-12">
                    <img src={selectedOperator.photoUrl} alt="Operator" className="h-full w-full object-cover" />
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900 text-center">{selectedOperator.firstName} {selectedOperator.lastName}</h2>
                  <p className="text-sm font-medium text-indigo-600 mt-1">{selectedOperator.association}</p>
                </div>
                
                {/* QR & Codes */}
                <div className="p-6 bg-slate-50 flex flex-col items-center">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Scan to Verify</p>
                  <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-200 mb-4">
                    <QrCode className="h-32 w-32 text-indigo-950" />
                  </div>
                  
                  <div className="w-full bg-white border border-slate-200 rounded-lg p-3 text-center">
                    <p className="text-xs text-slate-500 mb-1">Manual Entry Code</p>
                    <p className="text-2xl font-mono font-bold tracking-[0.2em] text-slate-900">{selectedOperator.code}</p>
                  </div>
                </div>
                
                {/* Footer */}
                <div className="bg-slate-900 p-3 text-center">
                  <p className="text-[10px] text-slate-400">Property of SafeRide Trust Network. If found, please return to nearest authority.</p>
                </div>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
              <strong>Printing Instructions:</strong> For best results, print on PVC CR80 cards using a specialized ID card printer. Ensure the QR code is printed clearly without smudges for reliable scanning.
            </div>
          </div>
        </div>
      </div>
  );
}
