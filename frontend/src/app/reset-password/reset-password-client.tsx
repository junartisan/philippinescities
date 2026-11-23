"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { AuthShell } from "@/components/auth-shell";
import { Alert, buttonClass, Field, inputClass, Spinner } from "@/components/ui";

export function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (!token) {
      setError("Missing reset token.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await api<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: { token, password },
        auth: false,
      });
      setSuccess(result.message);
      setPassword("");
      setConfirm("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Reset password"
      subtitle="Choose a new password for your Philippines Cities account."
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
        <Field label="New password" htmlFor="password">
          <input
            id="password"
            type="password"
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <Field label="Confirm new password" htmlFor="confirm">
          <input
            id="confirm"
            type="password"
            className={inputClass}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </Field>
        <button type="submit" className={buttonClass("primary", "md", "w-full")} disabled={submitting || !token}>
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          Reset password
        </button>
      </form>
    </AuthShell>
  );
}
