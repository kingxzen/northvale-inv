"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/forms/field";
import { signInLocal } from "@/lib/local-auth";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const session = signInLocal(
      String(formData.get("username") ?? ""),
      String(formData.get("password") ?? ""),
      String(formData.get("secretKey") ?? "")
    );

    if (!session) {
      setError("Invalid username, password, or secret key");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field id="username" label="Username">
        <Input id="username" name="username" autoComplete="username" required />
      </Field>
      <Field id="password" label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Field id="secretKey" label="Secret key">
        <Input id="secretKey" name="secretKey" type="password" autoComplete="off" required />
      </Field>
      {error ? <p className="text-body-sm text-error">{error}</p> : null}
      <Button className="w-full" disabled={loading} type="submit">
        <LogIn className="h-5 w-5" />
        {loading ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
