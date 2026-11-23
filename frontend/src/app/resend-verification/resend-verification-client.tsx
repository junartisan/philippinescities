"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { AuthShell } from "@/components/auth-shell";
import { Alert, buttonClass, Field, inputClass, Spinner } from "@/components/ui";

export function ResendVerificationClient() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    try {
      const result = await api<{ message: string }>("/api/auth/resend-verification", {
        method: "POST",
        body: { email: email.trim() },
        auth: false,
      });
      setSuccess(result.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Resend confirmation email"
      subtitle="Enter your email to receive a new confirmation link."
      footer={
        <p>
          <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Back to login
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </Field>
        <button type="submit" className={buttonClass("primary", "md", "w-full")} disabled={submitting}>
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          Send confirmation email
        </button>
      </form>
    </AuthShell>
  );
}
