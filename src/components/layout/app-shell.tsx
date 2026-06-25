"use client";

import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLocalSession, type LocalSession } from "@/lib/local-auth";
import { useApp } from "@/context/app-context";
import { X } from "lucide-react";

export interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title = "NORTHVALE INV" }: AppShellProps) {
  const router = useRouter();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [checked, setChecked] = useState(false);
  const { realtimeAlerts, dismissRealtimeAlert } = useApp();

  useEffect(() => {
    const currentSession = getLocalSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }

    setSession(currentSession);
    setChecked(true);
  }, [router]);

  useEffect(() => {
    // Automatically clear alerts after 5 seconds to prevent screen clutter
    if (realtimeAlerts.length > 0) {
      const timers = realtimeAlerts.map(alert =>
        setTimeout(() => dismissRealtimeAlert(alert.id), 5000)
      );
      return () => timers.forEach(clearTimeout);
    }
  }, [realtimeAlerts, dismissRealtimeAlert]);

  if (!checked || !session) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-md place-items-center bg-background px-4 text-on-surface">
        <p className="text-body-sm text-on-surface-variant">Checking session...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col bg-background pb-24 text-on-surface">
      <TopBar title={title} session={session} />
      <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      
      {/* Real-time notifications log at the bottom */}
      {realtimeAlerts.length > 0 && (
        <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 space-y-2">
          {realtimeAlerts.map(alert => (
            <div
              key={alert.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-surface-container/95 p-3 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200"
            >
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Real-time Log</p>
                <p className="truncate text-[12px] font-medium text-white mt-0.5">{alert.message}</p>
              </div>
              <button
                onClick={() => dismissRealtimeAlert(alert.id)}
                className="rounded-full p-1 text-on-surface-variant hover:bg-white/10 hover:text-white transition shrink-0"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
