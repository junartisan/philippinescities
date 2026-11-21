"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { AuthShell } from "@/components/auth-shell";
import {
  Alert,
  buttonClass,
  PageLoader,
  Spinner,
} from "@/components/ui";
import { safeNextPath } from "@/lib/utils";

function oauthErrorMessage(code: string): string {
  switch (code) {
    case "cancelled":
      return "Sign-in was cancelled.";
    case "provider_unavailable":
      return "That sign-in provider is not configured.";
    case "invalid_state":
      return "The sign-in request expired. Please try again.";
    case "email_required":
      return "That provider did not share an email address. Please log in with email and password instead.";
    case "account_conflict":
      return "This email is already linked to a different social account.";
    case "account_inactive":
      return "This account is inactive. Contact an administrator for help.";
    default:
      return "We could not complete sign-in with that provider. Please try again.";
  }
}

function OAuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { oauthLogin } = useAuth();
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");
  const next = safeNextPath(searchParams.get("next"));
  const [error, setError] = useState("");

  useEffect(() => {
    if (providerError) {
      setError(oauthErrorMessage(providerError));
      return;
    }
    if (!code) {
      setError("The sign-in response was missing a code. Please try again.");
      return;
    }

    let active = true;
    oauthLogin(code)
      .then(() => {
        if (active) router.replace(next);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [code, providerError, next, oauthLogin, router]);

  const loginHref = `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthShell
      title={error ? "Sign-in problem" : "Finishing sign-in"}
      subtitle={
        error
          ? "We could not sign you in with that provider."
          : "Securing your session and taking you to your account."
      }
      footer={
        <p>
          Need help?{" "}
          <Link
            href={loginHref}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Return to log in
          </Link>
        </p>
      }
    >
      {error ? (
        <div className="space-y-4">
          <Alert>{error}</Alert>
          <div className="flex flex-wrap gap-2">
            <Link href={loginHref} className={buttonClass("primary", "sm")}>
              Try another way
            </Link>
            <Link
              href={`/register?next=${encodeURIComponent(next)}`}
              className={buttonClass("secondary", "sm")}
            >
              Create an account
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Verifying your sign-in…
        </div>
      )}
    </AuthShell>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<PageLoader label="Finishing sign-in…" />}>
      <OAuthCallbackInner />
    </Suspense>
  );
}
