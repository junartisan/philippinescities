"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ExternalLink, ShieldCheck, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  selectClass,
  Spinner,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type {
  BusinessVerification,
  BusinessVerificationStatus,
} from "@/lib/types";

type StatusFilter = BusinessVerificationStatus | "all";

function methodLabel(method: BusinessVerification["method"]) {
  if (method === "domain_email") return "Domain email";
  if (method === "branch_staff") return "Branch staff";
  return "Registration";
}

function statusTone(
  status: BusinessVerificationStatus,
): "emerald" | "amber" | "rose" | "stone" {
  if (status === "verified") return "emerald";
  if (status === "pending") return "amber";
  if (status === "rejected") return "rose";
  return "stone";
}

export default function AdminVerificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [records, setRecords] = useState<BusinessVerification[]>([]);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isAdmin = hasRole(user, "admin");

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError("");
    try {
      const path =
        status === "all"
          ? "/api/admin/verifications"
          : `/api/admin/verifications?status=${status}`;
      const data = await api<BusinessVerification[]>(path);
      setRecords(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, isAdmin]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active || authLoading) return;
      if (!isAdmin) {
        setLoading(false);
        setError("Only admins can review verification requests.");
        return;
      }
      void load();
    });
    return () => {
      active = false;
    };
  }, [authLoading, load, isAdmin]);

  async function decide(
    verificationId: number,
    decision: "approve" | "reject",
  ) {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/admin/verifications/${verificationId}/${decision}`,
        {
          method: "POST",
          body: { admin_notes: notes[verificationId]?.trim() || null },
        },
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || loading) {
    return <PageLoader label="Loading verification requests…" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Business verifications
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Review registration requests and manual verification details.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Status
          <select
            className={selectClass}
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="unverified">Unverified</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {records.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="No verification requests"
          description="Businesses can submit verification details from their listing page."
        />
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <li
              key={record.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-900">
                      {record.business?.name ?? `Business #${record.business_id}`}
                    </h3>
                    <Badge tone={statusTone(record.status)}>
                      {record.status}
                    </Badge>
                    <Badge tone="violet">{methodLabel(record.method)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Submitted {formatDate(record.created_at)}
                    {record.reviewed_at
                      ? ` · Reviewed ${formatDate(record.reviewed_at)}`
                      : ""}
                  </p>
                </div>
                {record.business ? (
                  <Link
                    href={`/businesses/${record.business.slug}`}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    View listing
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 space-y-1 text-sm text-slate-600">
                {record.reference ? (
                  <p>
                    <span className="font-medium text-slate-700">Reference:</span>{" "}
                    {record.reference}
                  </p>
                ) : null}
                {record.document_url ? (
                  <a
                    href={record.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 hover:underline"
                  >
                    View supporting document
                  </a>
                ) : null}
                {record.notes ? (
                  <p>
                    <span className="font-medium text-slate-700">Notes:</span>{" "}
                    {record.notes}
                  </p>
                ) : null}
                {record.admin_notes ? (
                  <p>
                    <span className="font-medium text-slate-700">
                      Admin notes:
                    </span>{" "}
                    {record.admin_notes}
                  </p>
                ) : null}
              </div>

              {record.status === "pending" ? (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <input
                    className={inputClass}
                    placeholder="Admin notes (optional)"
                    value={notes[record.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [record.id]: event.target.value,
                      }))
                    }
                  />
                  <button
                    type="button"
                    className={buttonClass("primary", "sm")}
                    disabled={busy}
                    onClick={() => decide(record.id, "approve")}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </button>
                  <button
                    type="button"
                    className={buttonClass("secondary", "sm")}
                    disabled={busy}
                    onClick={() => decide(record.id, "reject")}
                  >
                    {busy ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Reject
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
