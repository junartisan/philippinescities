"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { AuthShell } from "@/components/auth-shell";
import { Alert, buttonClass, Spinner } from "@/components/ui";

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    token ? "loading" : "error",
  );
  const [message, setMessage] = useState(
    token ? "Confirming your email…" : "Missing verification token.",
  );

  useEffect(() => {
    if (!token) return;
    let active = true;
    void api<{ message: string }>("/api/auth/verify-email", {
      method: "POST",
      body: { token },
      auth: false,
    })
      .then((result) => {
        if (!active) return;
        setStatus("success");
        setMessage(result.message);
      })
      .catch((error) => {
        if (!active) return;
        setStatus("error");
        setMessage(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthShell
      title="Email confirmation"
      subtitle="Confirm your account to log in to Philippines Cities."
      footer={
        <p>
          <Link href="/login" className="font-semibold text-emerald-700 hover:text-emerald-800">
            Go to login
          </Link>
        </p>
      }
    >
      <div className="space-y-4">
        {status === "loading" ? (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="h-4 w-4" /> {message}
          </div>
        ) : (
          <Alert tone={status === "success" ? "success" : "danger"}>{message}</Alert>
        )}
        {status !== "loading" ? (
          <Link href="/login" className={buttonClass("primary", "md", "w-full")}>
            Continue to login
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
