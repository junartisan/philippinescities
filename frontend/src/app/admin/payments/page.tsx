"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Check,
  Clock3,
  Landmark,
  ReceiptText,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  Field,
  inputClass,
  PageLoader,
  Spinner,
  textareaClass,
} from "@/components/ui";
import {
  MANUAL_PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  manualPaymentTone,
} from "@/lib/payments";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  ManualPayment,
  ManualPaymentDecision,
  ManualPaymentStatus,
} from "@/lib/types";

type StatusFilter = ManualPaymentStatus | "all";

const tabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

function toLocalInput(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function defaultPaidUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toLocalInput(date);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [paidUntil, setPaidUntil] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const data = await api<ManualPayment[]>(
        `/api/admin/manual-payments${query}`,
      );
      setPayments(data);
      setPaidUntil((previous) => {
        const next = { ...previous };
        for (const payment of data) {
          if (!next[payment.id]) next[payment.id] = defaultPaidUntil();
        }
        return next;
      });
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

  async function decide(
    payment: ManualPayment,
    action: "approve" | "reject",
  ) {
    setBusyId(payment.id);
    setError("");
    setNotice("");
    try {
      const adminNotes = (notes[payment.id] ?? "").trim() || null;
      if (action === "approve") {
        const value = paidUntil[payment.id] ?? "";
        const iso = toIso(value);
        if (value && !iso) {
          setError("Enter a valid paid-until date and time.");
          return;
        }
        const payload: ManualPaymentDecision = {
          paid_until: iso,
          admin_notes: adminNotes,
        };
        await api(`/api/admin/manual-payments/${payment.id}/approve`, {
          method: "POST",
          body: payload,
        });
        setNotice(
          `Approved ${PAYMENT_METHOD_LABELS[payment.method].toLowerCase()} payment for ${payment.business.name}. Article access is now active.`,
        );
      } else {
        await api(`/api/admin/manual-payments/${payment.id}/reject`, {
          method: "POST",
          body: { admin_notes: adminNotes },
        });
        setNotice(`Rejected payment request for ${payment.business.name}.`);
      }
      setNotes((previous) => ({ ...previous, [payment.id]: "" }));
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
        <h2 className="text-lg font-semibold text-slate-900">
          Cash and bank payments
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review manual payment requests from business owners. Approving one
          unlocks article publishing for the selected period.
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
        <PageLoader label="Loading payment requests…" />
      ) : payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptText className="h-5 w-5" />}
          title="No payment requests in this view"
          description="New cash and bank transfer requests will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {payments.map((payment) => {
            const busy = busyId === payment.id;
            const isPending = payment.status === "pending";
            return (
              <li
                key={payment.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      {payment.method === "cash" ? (
                        <Banknote className="h-5 w-5" />
                      ) : (
                        <Landmark className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {PAYMENT_METHOD_LABELS[payment.method]}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          {payment.reference || "No reference"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm text-slate-600">
                        For{" "}
                        <Link
                          href={`/businesses/${payment.business.slug}`}
                          className="font-medium text-emerald-700 hover:text-emerald-800"
                        >
                          {payment.business.name}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {payment.user
                          ? `${payment.user.full_name} · ${payment.user.email} · `
                          : ""}
                        Submitted {formatDateTime(payment.created_at)}
                      </p>
                    </div>
                  </div>
                  <Badge tone={manualPaymentTone(payment.status)}>
                    {payment.status === "pending" ? (
                      <Clock3 className="h-3 w-3" />
                    ) : payment.status === "approved" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <X className="h-3 w-3" />
                    )}
                    {MANUAL_PAYMENT_STATUS_LABELS[payment.status]}
                  </Badge>
                </div>

                <dl className="mt-4 grid gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs sm:grid-cols-3">
                  <div>
                    <dt className="text-slate-400">Method</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Reference</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {payment.reference || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">
                      {payment.status === "approved"
                        ? "Paid until"
                        : "Reviewed"}
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {payment.status === "approved"
                        ? formatDate(payment.paid_until)
                        : formatDate(payment.reviewed_at)}
                    </dd>
                  </div>
                </dl>

                {payment.notes ? (
                  <p className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-stone-200">
                    Owner notes: {payment.notes}
                  </p>
                ) : null}
                {payment.admin_notes ? (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                    Admin note: {payment.admin_notes}
                  </p>
                ) : null}

                {isPending ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Access paid until"
                        htmlFor={`paid-until-${payment.id}`}
                        hint="Leave as-is for 30 days from now."
                      >
                        <input
                          id={`paid-until-${payment.id}`}
                          type="datetime-local"
                          className={inputClass}
                          value={paidUntil[payment.id] ?? ""}
                          onChange={(event) =>
                            setPaidUntil((previous) => ({
                              ...previous,
                              [payment.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Admin notes"
                        htmlFor={`payment-notes-${payment.id}`}
                        hint="Optional. Shown to the business owner."
                      >
                        <textarea
                          id={`payment-notes-${payment.id}`}
                          className={textareaClass}
                          value={notes[payment.id] ?? ""}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [payment.id]: event.target.value,
                            }))
                          }
                          maxLength={2000}
                          placeholder="Verified receipt OR-1042."
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void decide(payment, "approve")}
                        disabled={busy}
                        className={buttonClass("primary", "sm")}
                      >
                        {busy ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve payment
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(payment, "reject")}
                        disabled={busy}
                        className={buttonClass(
                          "secondary",
                          "sm",
                          "text-rose-600 hover:border-rose-200 hover:text-rose-700",
                        )}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
