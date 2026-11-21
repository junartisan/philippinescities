"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Business, Claim } from "@/lib/types";
import {
  Alert,
  buttonClass,
  Spinner,
  textareaClass,
} from "@/components/ui";

export function ClaimBox({ business }: { business: Business }) {
  const { user, loading } = useAuth();
  const [existing, setExisting] = useState<Claim | null>(null);
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user) {
      setExisting(null);
      return;
    }
    let active = true;
    setChecking(true);
    api<Claim[]>("/api/claims/mine")
      .then((claims) => {
        if (!active) return;
        const pending = claims.find(
          (claim) =>
            claim.business_id === business.id && claim.status === "pending",
        );
        setExisting(pending ?? null);
      })
      .catch(() => {
        if (active) setExisting(null);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [user, business.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const claim = await api<Claim>("/api/claims", {
        method: "POST",
        body: {
          business_id: business.id,
          message: message.trim() || null,
        },
      });
      setExisting(claim);
      setSuccess("Claim submitted. An admin will verify it shortly.");
      setOpen(false);
      setMessage("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  const isOwner = Boolean(user && business.owner?.id === user.id);
  const loginHref = `/login?next=${encodeURIComponent(
    `/businesses/${business.slug}`,
  )}`;
  const editHref = `/dashboard/listings/${business.id}/edit`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-900">
          {isOwner ? "You manage this listing" : "Is this your business?"}
        </h2>
      </div>

      {isOwner || user?.role === "admin" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-500">
            Keep your details, contact information, and description up to date.
          </p>
          <Link
            href={editHref}
            className={buttonClass("secondary", "sm", "w-full")}
          >
            Edit listing
          </Link>
        </div>
      ) : business.status !== "approved" ? (
        <p className="mt-3 text-sm text-slate-500">
          This listing is {business.status} and cannot be claimed yet.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-slate-500">
            Own or manage this business? Request access and an admin will verify
            your claim before transferring ownership.
          </p>

          {checking ? (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Spinner className="h-3.5 w-3.5 text-emerald-600" />
              Checking your claims…
            </div>
          ) : null}

          {success ? <Alert tone="success">{success}</Alert> : null}
          {error ? <Alert>{error}</Alert> : null}

          {existing ? (
            <Alert tone="warning">
              Your claim is pending admin approval.
            </Alert>
          ) : user ? (
            open ? (
              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  className={textareaClass}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell the admin how you are connected to this business."
                  maxLength={1000}
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className={buttonClass("primary", "sm", "flex-1")}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Spinner className="h-4 w-4" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Submit claim
                  </button>
                  <button
                    type="button"
                    className={buttonClass("ghost", "sm")}
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                className={buttonClass("primary", "sm", "w-full")}
                onClick={() => setOpen(true)}
              >
                Claim this listing
              </button>
            )
          ) : (
            <div className="space-y-2">
              <Link
                href={loginHref}
                className={buttonClass("primary", "sm", "w-full")}
              >
                Log in to claim
              </Link>
              <Link
                href={`/register?next=${encodeURIComponent(
                  `/businesses/${business.slug}`,
                )}`}
                className={buttonClass("secondary", "sm", "w-full")}
              >
                Create an account
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
