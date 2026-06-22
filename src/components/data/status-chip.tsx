import { Badge } from "@/components/ui/badge";
import type { ProductionStatus, StockStatus } from "@/types/domain";

export interface StatusChipProps {
  status: ProductionStatus | StockStatus;
}

export function StatusChip({ status }: StatusChipProps) {
  const tone =
    status === "critical" || status === "blocked"
      ? "critical"
      : status === "low"
        ? "low"
        : status === "good" || status === "completed" || status === "ready" || status === "to_process"
          ? "good"
          : "neutral";

  return <Badge tone={tone}>{status.replace("_", " ").toUpperCase()}</Badge>;
}
