"use client";

import { BottomNav } from "@/components/layout/bottom-nav";
import { TopBar } from "@/components/layout/top-bar";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLocalSession, type LocalSession } from "@/lib/local-auth";

export interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export function AppShell({ children, title = "NORTHVALE INV" }: AppShellProps) {
  const router = useRouter();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const currentSession = getLocalSession();
    if (!currentSession) {
      router.replace("/login");
      return;
    }

    setSession(currentSession);
    setChecked(true);
  }, [router]);

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
      <BottomNav />
    </div>
  );
}
