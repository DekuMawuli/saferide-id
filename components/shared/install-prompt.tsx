'use client';

import { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function InstallPrompt() {
  const [isMounted, setIsMounted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      
      // Check if already dismissed
      const isDismissed = localStorage.getItem('saferide-pwa-dismissed');
      if (!isDismissed) {
        setIsVisible(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('saferide-pwa-dismissed', 'true');
  };

  if (!isMounted || !isVisible) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-md mx-auto bg-indigo-950 text-white rounded-xl shadow-2xl p-4 flex items-center gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
        
        <div className="bg-indigo-900/50 p-2 rounded-lg shrink-0">
          <Download className="h-6 w-6 text-indigo-300" />
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">Install SafeRide App</p>
          <p className="text-xs text-indigo-300 truncate">Get faster access and offline support.</p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Button 
            size="sm" 
            className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 text-xs px-3"
            onClick={handleInstall}
          >
            Install
          </Button>
          <button 
            onClick={handleDismiss}
            className="p-1.5 text-indigo-400 hover:text-white hover:bg-indigo-900 rounded-md transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
