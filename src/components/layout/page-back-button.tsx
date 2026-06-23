"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type PageBackButtonProps = {
  fallbackHref: string;
  label?: string;
  className?: string;
};

export function PageBackButton({ fallbackHref, label = "Back", className }: PageBackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      if (referrer?.origin === window.location.origin) {
        router.back();
        return;
      }
    } catch {
      // Fall back to the route below when referrer parsing fails.
    }

    router.push(fallbackHref);
  };

  return (
    <Button type="button" variant="ghost" size="sm" className={className ?? "mb-3 h-9 px-2"} onClick={handleBack}>
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Button>
  );
}
