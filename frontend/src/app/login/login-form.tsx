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

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login } = useAuth();
  const next = safeNextPath(searchParams.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.push(next);
    } catch (err) {
      setError(errorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage your listings and leave reviews."
      footer={
        <p>
          New to Philippines Cities?{" "}
          <Link
            href={`/register?next=${encodeURIComponent(next)}`}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <Alert>
            <div className="space-y-1">
              <p>{error}</p>
              {error.toLowerCase().includes("confirm your email") ? (
                <Link
                  href={`/resend-verification?email=${encodeURIComponent(email.trim())}`}
                  className="font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Resend confirmation email
                </Link>
              ) : null}
            </div>
          </Alert>
        ) : null}
        <Field label="Email address" htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field label="Password" htmlFor="password">
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your password"
            required
          />
        </Field>
        <button
          type="submit"
          className={buttonClass("primary", "md", "w-full")}
          disabled={submitting}
        >
          {submitting ? <Spinner className="h-4 w-4" /> : null}
          Log in
        </button>
      </form>
      <OAuthButtons next={next} />
    </AuthShell>
  );
}
