import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "primary" | "critical" | "low" | "neutral";
}

const toneClasses = {
  primary: "border-l-primary text-primary",
  critical: "border-l-error text-error",
  low: "border-l-cobalt text-secondary",
  neutral: "border-l-outline text-on-surface-variant"
};

export function StatCard({ label, value, icon: Icon, tone = "neutral" }: StatCardProps) {
  return (
    <Card className={cn("flex items-center gap-5 border-l-4 p-5", toneClasses[tone])}>
      <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-surface-container-high">
        <Icon className="h-7 w-7" />
      </div>
      <div>
        <p className="text-body-lg text-on-surface-variant">{label}</p>
        <p className="mt-1 text-headline-md text-on-surface">{value}</p>
      </div>
    </Card>
  );
}
