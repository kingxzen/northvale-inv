import { Label } from "@/components/ui/label";

export interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-body-sm text-error">{error}</p> : null}
    </div>
  );
}
