"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { AuthShell } from "@/components/auth-shell";
import { OAuthButtons } from "@/components/oauth-buttons";
import {
  Alert,
  buttonClass,
  Field,
  inputClass,
  Spinner,
} from "@/components/ui";
import { safeNextPath } from "@/lib/utils";

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, register } = useAuth();
  const next = safeNextPath(searchParams.get("next"));

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
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
      await register({
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });
      router.push(next);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register to claim listings, manage your business, and write reviews."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Log in
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field label="Full name" htmlFor="full_name">
          <input
            id="full_name"
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            placeholder="Juan Dela Cruz"
            required
            minLength={2}
          />
        </Field>
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label="Phone (optional)" htmlFor="phone">
          <input
            id="phone"
            className={inputClass}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+63 9xx xxx xxxx"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password">
            <input
              id="password"
              type="password"
              className={inputClass}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              required
              minLength={8}
            />
          </Field>
          <Field label="Confirm password" htmlFor="confirm">
            <input
              id="confirm"
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
              placeholder="Repeat password"
              required
              minLength={8}
            />
          </Field>
        </div>
        <button
          type="submit"
          className={buttonClass("primary", "md", "w-full")}
          disabled={submitting}
        >
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          Create account
        </button>
      </form>
      <OAuthButtons next={next} />
    </AuthShell>
  );
}
