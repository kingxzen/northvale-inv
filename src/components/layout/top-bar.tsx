"use client";

import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { clearLocalSession, type LocalSession } from "@/lib/local-auth";

export interface TopBarProps {
  title: string;
  session: LocalSession;
}

export function TopBar({ title, session }: TopBarProps) {
  const router = useRouter();

  const handleLogout = () => {
    clearLocalSession();
    router.replace("/login");
  };

  return (
    <header className="sticky top-0 z-30 flex h-[86px] items-center justify-between border-b border-outline-variant/35 bg-background/88 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-primary/50 bg-navy text-label-sm text-primary shadow-glow">
          NI
        </div>
        <div className="min-w-0">
          <h1 className="truncate font-headline text-[18px] font-bold leading-5 text-primary sm:text-headline-lg">{title}</h1>
          <p className="mt-0.5 text-[10.5px] font-semibold uppercase leading-3 text-on-surface-variant">
            {session.role} • {session.username}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button aria-label="Logout" size="sm" variant="ghost" className="h-9 px-2 text-[11px]" onClick={handleLogout}>
          Logout
        </Button>
        <Button aria-label="Search" size="icon" variant="ghost">
          <Search className="h-5 w-5" />
        </Button>
        <Button aria-label="Notifications" size="icon" variant="ghost">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
}
