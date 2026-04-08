'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserQRCodeReader } from '@zxing/browser';
import type { IScannerControls } from '@zxing/browser';
import { Navbar } from '@/components/shared/navbar';
import { Footer } from '@/components/shared/footer';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { QrCode, Search, ShieldAlert, ArrowLeft, Hash, Loader2 } from 'lucide-react';

type Step = 'choose' | 'qr' | 'code';

type ScannerStatus = 'off' | 'starting' | 'scanning' | 'error';

function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera access was blocked. Tap the lock or site settings icon in your browser’s address bar and allow camera, then try again.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No camera was found on this device. Use “Enter short code” instead.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'The camera is already in use or cannot be opened. Close other apps using the camera and try again.';
    }
    if (err.name === 'OverconstrainedError') {
      return 'This camera does not support the required mode. Try again or use the short code option.';
    }
    return err.message || 'Could not open the camera.';
  }
  if (err instanceof Error) return err.message;
  return 'Could not open the camera.';
}

/** QR may contain a raw code or a full verify URL — normalize to short-code slug. */
function parseVerifyCodeFromQr(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  try {
    const u = new URL(t);
    const path = u.pathname;
    const marker = '/verify/result/';
    const idx = path.indexOf(marker);
    if (idx !== -1) {
      const rest = path.slice(idx + marker.length).split('/')[0];
      if (rest) return decodeURIComponent(rest);
    }
    const parts = path.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : t;
  } catch {
    return t;
  }
}

export default function VerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('choose');
  const [code, setCode] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [scannerStatus, setScannerStatus] = useState<ScannerStatus>('off');
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopScanner = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* ignore */
    }
    controlsRef.current = null;
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScannerStatus('off');
    setCameraError(null);
  }, []);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const v = videoRef.current;
      if (v) v.srcObject = null;
    };
  }, []);

  const handleStartCamera = async () => {
    setCameraError(null);
    const video = videoRef.current;
    if (!video) {
      setCameraError('Camera preview is not ready. Please refresh the page.');
      setScannerStatus('error');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Your browser does not support camera access. Use the short code option or try Chrome or Safari.');
      setScannerStatus('error');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setCameraError('Camera requires a secure page. Use https:// or open the site on localhost.');
      setScannerStatus('error');
      return;
    }

    stopScanner();
    setScannerStatus('starting');

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Many phones reject combined ideal constraints; fall back to any camera.
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
      streamRef.current = stream;

      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromStream(stream, video, (result, _err, ctrl) => {
        if (!result) return;
        const text = parseVerifyCodeFromQr(result.getText());
        if (!text) return;
        try {
          ctrl.stop();
        } catch {
          /* ignore */
        }
        controlsRef.current = null;
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        video.srcObject = null;
        setScannerStatus('off');
        router.push(`/verify/result/${encodeURIComponent(text)}`);
      });
      controlsRef.current = controls;
      setScannerStatus('scanning');
      void video.play().catch(() => {
        /* play() can fail if interrupted; stream may still show */
      });
    } catch (e) {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      video.srcObject = null;
      setCameraError(getCameraErrorMessage(e));
      setScannerStatus('error');
    }
  };

  const handleVerify = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (code.trim()) {
      router.push(`/verify/result/${code.trim()}`);
    }
  };

  const goBackFromQr = () => {
    stopScanner();
    setStep('choose');
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="container mx-auto max-w-lg flex-1 px-4 py-10 md:py-16">

        {/* ── STEP 1: choose ──────────────────────────────────────────── */}
        {step === 'choose' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-bold text-indigo-950">Verify a Driver</h1>
              <p className="text-muted-foreground">How do you want to verify?</p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* QR option */}
              <button
                type="button"
                onClick={() => setStep('qr')}
                className="group relative flex flex-col items-center gap-5 rounded-2xl border-2 border-indigo-100 bg-white p-8 text-left shadow-sm transition-all hover:border-indigo-400 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 transition-colors group-hover:bg-indigo-100">
                  <QrCode className="h-8 w-8 text-indigo-600" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-lg font-bold text-indigo-950">Scan QR Code</p>
                  <p className="text-sm text-muted-foreground">Point your camera at the driver&apos;s SafeRide badge or vest</p>
                </div>
                <span className="rounded-full bg-indigo-50 px-3 py-0.5 text-xs font-medium text-indigo-600">Fastest</span>
              </button>

              {/* Code option */}
              <button
                type="button"
                onClick={() => setStep('code')}
                className="group relative flex flex-col items-center gap-5 rounded-2xl border-2 border-slate-100 bg-white p-8 text-left shadow-sm transition-all hover:border-slate-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 transition-colors group-hover:bg-slate-100">
                  <Hash className="h-8 w-8 text-slate-600" />
                </div>
                <div className="space-y-1 text-center">
                  <p className="text-lg font-bold text-indigo-950">Enter Short Code</p>
                  <p className="text-sm text-muted-foreground">Type the code printed on the vehicle or driver&apos;s badge</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600">No camera needed</span>
              </button>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              <p className="text-sm">
                <span className="font-semibold">Safety first — </span>
                do not board if the driver refuses to show their code or if the details don&apos;t match.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 2a: QR scan ────────────────────────────────────────── */}
        {step === 'qr' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button
              type="button"
              onClick={goBackFromQr}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-indigo-600"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-bold text-indigo-950">Scan QR Code</h2>
              <p className="text-sm text-muted-foreground">Point your camera at the driver&apos;s SafeRide badge</p>
            </div>

            <div className="space-y-4 rounded-2xl border-2 border-dashed border-indigo-200 bg-white p-6 shadow-sm">
              <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-slate-900">
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  playsInline
                  muted
                  autoPlay
                  aria-label="Camera preview for QR scanning"
                />

                {scannerStatus === 'off' && (
                  <button
                    type="button"
                    onClick={() => void handleStartCamera()}
                    className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-indigo-950/85 px-4 text-center transition-colors hover:bg-indigo-950/90"
                  >
                    <QrCode className="h-16 w-16 text-indigo-200" />
                    <span className="font-semibold text-white">Tap to start camera</span>
                    <span className="max-w-[240px] text-xs text-indigo-200">
                      Your browser will ask for permission — choose &quot;Allow&quot; to scan.
                    </span>
                  </button>
                )}

                {scannerStatus === 'starting' && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-indigo-950/80 text-white">
                    <Loader2 className="h-10 w-10 animate-spin text-emerald-400" />
                    <p className="text-sm font-medium">Waiting for camera…</p>
                    <p className="max-w-[260px] px-4 text-center text-xs text-indigo-200">
                      Allow access in the browser prompt. If you dismissed it, reset permission in the address bar and tap again.
                    </p>
                  </div>
                )}

                {scannerStatus === 'scanning' && (
                  <>
                    <div className="pointer-events-none absolute inset-6 z-[1] rounded-lg border-4 border-emerald-400/70 shadow-[inset_0_0_20px_rgba(16,185,129,0.12)]" />
                    <div className="pointer-events-none absolute inset-6 z-[2] overflow-hidden rounded-lg">
                      <div className="qr-scanner-sweep" aria-hidden />
                    </div>
                    <p className="absolute bottom-3 left-0 right-0 z-10 text-center text-sm font-medium text-white drop-shadow-md">
                      Scanning… align QR in the frame
                    </p>
                  </>
                )}

                {scannerStatus === 'error' && cameraError && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-indigo-950/92 p-4 text-center">
                    <p className="text-sm text-indigo-100">{cameraError}</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button type="button" size="sm" className="bg-emerald-500 text-white hover:bg-emerald-400" onClick={() => void handleStartCamera()}>
                        Try again
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="border-indigo-400 text-white hover:bg-indigo-800" onClick={() => { setCameraError(null); setScannerStatus('off'); }}>
                        Dismiss
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {(scannerStatus === 'scanning' || scannerStatus === 'starting') && (
                <Button type="button" variant="outline" className="w-full" onClick={stopScanner}>
                  Cancel
                </Button>
              )}
            </div>

            <p className="text-center text-sm text-muted-foreground">
              No QR code?{' '}
              <button
                type="button"
                onClick={() => {
                  stopScanner();
                  setStep('code');
                }}
                className="font-medium text-indigo-600 hover:underline"
              >
                Enter the short code instead
              </button>
            </p>
          </div>
        )}

        {/* ── STEP 2b: short code ─────────────────────────────────────── */}
        {step === 'code' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-indigo-600"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>

            <div className="space-y-1 text-center">
              <h2 className="text-2xl font-bold text-indigo-950">Enter Short Code</h2>
              <p className="text-sm text-muted-foreground">
                Find this code on the driver&apos;s vest, badge, or vehicle sticker
              </p>
            </div>

            {/* where to find it */}
            <div className="space-y-3 rounded-2xl bg-indigo-950 p-5">
              <p className="text-xs font-semibold tracking-widest text-indigo-400 uppercase">Where to find it</p>
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1.5">
                  {['Vest / jacket badge', 'Vehicle windscreen sticker', 'Digital profile card'].map((loc) => (
                    <div key={loc} className="flex items-center gap-2 text-sm text-indigo-200">
                      <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {loc}
                    </div>
                  ))}
                </div>
                <div className="ml-auto rounded-xl border border-indigo-700 bg-indigo-900 px-4 py-3 text-center">
                  <p className="mb-1 text-[10px] font-medium tracking-widest text-indigo-400 uppercase">Looks like</p>
                  <span className="font-mono text-lg font-bold tracking-widest text-white">AB3KPQR7</span>
                </div>
              </div>
            </div>

            {/* code input card */}
            <form onSubmit={handleVerify}>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
                  <Label htmlFor="code" className="text-sm font-semibold text-slate-700">
                    Driver Code
                  </Label>
                </div>
                <div className="space-y-5 px-6 py-6">
                  {/* character display cells — clicking focuses the hidden input */}
                  <div
                    className="flex cursor-text flex-wrap justify-center gap-1.5"
                    onClick={() => document.getElementById('code')?.focus()}
                  >
                    {Array.from({ length: 8 }).map((_, i) => {
                      const char = code[i];
                      const filled = !!char;
                      const isNext = i === code.length;
                      return (
                        <div
                          key={i}
                          className={[
                            'flex h-12 w-10 items-center justify-center rounded-lg border-2 font-mono text-lg font-bold transition-all',
                            filled
                              ? 'scale-105 border-indigo-500 bg-indigo-50 text-indigo-900'
                              : isNext
                                ? 'animate-pulse border-indigo-300 bg-white text-transparent'
                                : 'border-slate-200 bg-slate-50 text-transparent',
                          ].join(' ')}
                        >
                          {filled ? char : '·'}
                        </div>
                      );
                    })}
                  </div>

                  <input
                    id="code"
                    type="text"
                    inputMode="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    className="pointer-events-none absolute h-0 w-0 opacity-0"
                    maxLength={8}
                    autoFocus
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Driver short code"
                  />

                  <Button
                    type="submit"
                    className="h-12 w-full gap-2 bg-indigo-600 text-base font-semibold hover:bg-indigo-700 disabled:opacity-40"
                    disabled={!code.trim()}
                  >
                    <Search className="h-4 w-4" />
                    Verify Driver
                  </Button>
                </div>
              </div>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Have a QR code?{' '}
              <button type="button" onClick={() => setStep('qr')} className="font-medium text-indigo-600 hover:underline">
                Scan it instead
              </button>
            </p>
          </div>
        )}

      </main>

      <Footer />
    </div>
  );
}
