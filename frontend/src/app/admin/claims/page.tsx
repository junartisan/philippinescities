"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ClipboardList, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Avatar,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  Spinner,
  StatusBadge,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import type { Claim, ClaimStatus } from "@/lib/types";

type StatusFilter = ClaimStatus | "all";

const tabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function AdminClaimsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const data = await api<Claim[]>(`/api/admin/claims${query}`);
      setClaims(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(claim: Claim, action: "approve" | "reject") {
    setBusyId(claim.id);
    setNotice("");
    try {
      await api(`/api/admin/claims/${claim.id}/${action}`, {
        method: "POST",
        body: { admin_notes: (notes[claim.id] ?? "").trim() || null },
      });
      setNotice(
        action === "approve"
          ? `Ownership transferred to ${claim.user.full_name}.`
          : "Claim rejected.",
      );
      setNotes((previous) => ({ ...previous, [claim.id]: "" }));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Ownership claims</h2>
        <p className="mt-1 text-sm text-slate-500">
          Approving a claim transfers the listing to the requester and promotes
          them to a business owner.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => {
              setStatus(tab.value);
              setNotice("");
            }}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              status === tab.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-stone-200 hover:text-slate-900",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <PageLoader label="Loading claims…" />
      ) : claims.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No claims in this view"
          description="New ownership requests will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {claims.map((claim) => (
            <li
              key={claim.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <Avatar
                    name={claim.user.full_name}
                    seed={claim.user.id}
                    size="sm"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {claim.user.full_name}
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        {claim.user.email}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      wants to claim{" "}
                      <Link
                        href={`/businesses/${claim.business.slug}`}
                        className="font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        {claim.business.name}
                      </Link>
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Submitted {formatDate(claim.created_at)}
                      {claim.reviewed_at
                        ? ` · Reviewed ${formatDate(claim.reviewed_at)}`
                        : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={claim.status} />
              </div>

              {claim.message ? (
                <p className="mt-3 rounded-xl bg-stone-50 px-3.5 py-2.5 text-sm text-slate-600">
                  {claim.message}
                </p>
              ) : null}
              {claim.admin_notes ? (
                <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                  Admin note: {claim.admin_notes}
                </p>
              ) : null}

              {claim.status === "pending" ? (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    className={inputClass}
                    value={notes[claim.id] ?? ""}
                    onChange={(event) =>
                      setNotes((previous) => ({
                        ...previous,
                        [claim.id]: event.target.value,
                      }))
                    }
                    placeholder="Admin notes (optional)"
                    maxLength={1000}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decide(claim, "approve")}
                      disabled={busyId === claim.id}
                      className={buttonClass("primary", "sm")}
                    >
                      {busyId === claim.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(claim, "reject")}
                      disabled={busyId === claim.id}
                      className={buttonClass("secondary", "sm", "text-rose-600 hover:border-rose-200 hover:text-rose-700")}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
