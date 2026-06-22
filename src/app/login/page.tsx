import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full border border-primary/50 bg-navy text-label-md text-primary shadow-glow">
            NI
          </div>
          <div>
            <h1 className="text-headline-md text-primary">NORTHVALE INV</h1>
            <p className="text-body-sm text-on-surface-variant">Manufacturing inventory planner</p>
          </div>
        </div>
        <Card className="p-5">
          <LoginForm />
        </Card>
      </section>
    </main>
  );
}
