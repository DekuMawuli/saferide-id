import type {Metadata} from 'next';
import './globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/shared/install-prompt";
import { OauthFragmentHandler } from "@/components/auth/oauth-fragment-handler";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'SafeRide',
  description: 'Digital ID-backed trust platform for informal transport.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body suppressHydrationWarning>
        <TooltipProvider>
          <OauthFragmentHandler />
          {children}
          <Toaster />
          <InstallPrompt />
        </TooltipProvider>
      </body>
    </html>
  );
}
