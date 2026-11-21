"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ClipboardList } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  EmptyState,
  PageLoader,
  StatusBadge,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Claim } from "@/lib/types";

export default function MyClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<Claim[]>("/api/claims/mine")
      .then((data) => {
        if (active) setClaims(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PageLoader label="Loading your claims…" />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">My claims</h2>
        <p className="mt-1 text-sm text-slate-500">
          Ownership requests you have submitted. An admin reviews each claim
          before transferring a listing.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {claims.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No claims submitted"
          description="Found a listing you own? Open it and use the claim panel to request access."
          action={
            <Link href="/businesses" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
              Browse the directory
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/businesses/${claim.business.slug}`}
                    className="text-base font-semibold text-slate-900 hover:text-emerald-700"
                  >
                    {claim.business.name}
                  </Link>
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted {formatDate(claim.created_at)}
                    {claim.reviewed_at
                      ? ` · Reviewed ${formatDate(claim.reviewed_at)}`
                      : ""}
                  </p>
                </div>
                <StatusBadge status={claim.status} />
              </div>
              {claim.message ? (
                <div className="mt-3 rounded-xl bg-stone-50 px-3.5 py-3 text-sm text-slate-600">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Your message
                  </p>
                  <p className="mt-1">{claim.message}</p>
                </div>
              ) : null}
              {claim.admin_notes ? (
                <div className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                    Admin note
                  </p>
                  <p className="mt-1">{claim.admin_notes}</p>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
