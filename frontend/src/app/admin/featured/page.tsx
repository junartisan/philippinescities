"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Check,
  Clock3,
  CreditCard,
  Landmark,
  Sparkles,
  Trash2,
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
  FEATURED_PAYMENT_METHOD_LABELS,
  FEATURED_PAYMENT_STATUS_LABELS,
  FEATURED_REQUEST_STATUS_LABELS,
  featuredPaymentTone,
  featuredRequestTone,
} from "@/lib/payments";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  FeaturedRequest,
  FeaturedRequestDecision,
  FeaturedRequestStatus,
} from "@/lib/types";

type StatusFilter = FeaturedRequestStatus | "all";

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

function defaultFeaturedUntil(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return toLocalInput(date);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminFeaturedPage() {
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [requests, setRequests] = useState<FeaturedRequest[]>([]);
  const [featuredUntil, setFeaturedUntil] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = status === "all" ? "" : `?status=${status}`;
      const data = await api<FeaturedRequest[]>(
        `/api/admin/featured-requests${query}`,
      );
      setRequests(data);
      setFeaturedUntil((previous) => {
        const next = { ...previous };
        for (const request of data) {
          if (!next[request.id]) next[request.id] = defaultFeaturedUntil();
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
    request: FeaturedRequest,
    action: "approve" | "reject",
  ) {
    setBusyId(request.id);
    setError("");
    setNotice("");
    try {
      const adminNotes = (notes[request.id] ?? "").trim() || null;
      if (action === "approve") {
        const value = featuredUntil[request.id] ?? "";
        const iso = toIso(value);
        if (value && !iso) {
          setError("Enter a valid featured-until date and time.");
          return;
        }
        const payload: FeaturedRequestDecision = {
          featured_until: iso,
          admin_notes: adminNotes,
        };
        await api(`/api/admin/featured-requests/${request.id}/approve`, {
          method: "POST",
          body: payload,
        });
        setNotice(
          `Featured placement approved for ${request.business.name} until ${formatDate(iso)}.`,
        );
      } else {
        await api(`/api/admin/featured-requests/${request.id}/reject`, {
          method: "POST",
          body: { admin_notes: adminNotes },
        });
        setNotice(`Featured request rejected for ${request.business.name}.`);
      }
      setNotes((previous) => ({ ...previous, [request.id]: "" }));
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removeFeatured(request: FeaturedRequest) {
    if (
      !window.confirm(
        `Remove the featured placement for ${request.business.name}?`,
      )
    ) {
      return;
    }
    setRemovingId(request.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/admin/businesses/${request.business_id}/featured`, {
        method: "DELETE",
      });
      setNotice(`Featured placement removed for ${request.business.name}.`);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Featured listings
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Review paid featured-placement requests. Approving one sets the
          placement expiry and moves the listing to the top of its city and
          category.
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
        <PageLoader label="Loading featured requests…" />
      ) : requests.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No featured requests in this view"
          description="Owners can request featured placement from their listing dashboard."
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((request) => {
            const busy = busyId === request.id;
            const isPending = request.status === "pending";
            const stripeUnpaid =
              request.payment_method === "stripe" &&
              request.payment_status !== "paid";
            return (
              <li
                key={request.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      {request.payment_method === "cash" ? (
                        <Banknote className="h-5 w-5" />
                      ) : request.payment_method === "bank_transfer" ? (
                        <Landmark className="h-5 w-5" />
                      ) : (
                        <CreditCard className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        <Link
                          href={`/businesses/${request.business.slug}`}
                          className="hover:text-emerald-700"
                        >
                          {request.business.name}
                        </Link>
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {request.business.category.name} ·{" "}
                        {request.business.city.name}
                        {request.business.city.province
                          ? `, ${request.business.city.province}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {request.user
                          ? `${request.user.full_name} · ${request.user.email} · `
                          : ""}
                        Submitted {formatDateTime(request.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={featuredRequestTone(request.status)}>
                      {FEATURED_REQUEST_STATUS_LABELS[request.status]}
                    </Badge>
                    <Badge tone={featuredPaymentTone(request.payment_status)}>
                      {FEATURED_PAYMENT_STATUS_LABELS[request.payment_status]}
                    </Badge>
                  </div>
                </div>

                <dl className="mt-4 grid gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="text-slate-400">Payment method</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {FEATURED_PAYMENT_METHOD_LABELS[request.payment_method]}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Reference</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {request.payment_reference || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">
                      {request.status === "approved"
                        ? "Featured until"
                        : "Reviewed"}
                    </dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {request.status === "approved"
                        ? formatDate(request.featured_until)
                        : formatDate(request.reviewed_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Requested placement</dt>
                    <dd className="mt-0.5 font-medium text-slate-700">
                      {request.business.city.name} /{" "}
                      {request.business.category.name}
                    </dd>
                  </div>
                </dl>

                {request.message ? (
                  <p className="mt-3 rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-stone-200">
                    Owner message: {request.message}
                  </p>
                ) : null}
                {request.payment_notes ? (
                  <p className="mt-2 rounded-xl bg-white px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-stone-200">
                    Payment notes: {request.payment_notes}
                  </p>
                ) : null}
                {request.admin_notes ? (
                  <p className="mt-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
                    Admin note: {request.admin_notes}
                  </p>
                ) : null}

                {stripeUnpaid && isPending ? (
                  <div className="mt-3">
                    <Alert tone="warning">
                      Stripe payment has not been completed. The placement
                      cannot be approved until Stripe confirms payment.
                    </Alert>
                  </div>
                ) : null}

                {isPending ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field
                        label="Featured until"
                        htmlFor={`featured-until-${request.id}`}
                        hint="Leave as-is for 30 days from now."
                      >
                        <input
                          id={`featured-until-${request.id}`}
                          type="datetime-local"
                          className={inputClass}
                          value={featuredUntil[request.id] ?? ""}
                          onChange={(event) =>
                            setFeaturedUntil((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))
                          }
                        />
                      </Field>
                      <Field
                        label="Admin notes"
                        htmlFor={`featured-notes-${request.id}`}
                        hint="Optional. Shown to the business owner."
                      >
                        <textarea
                          id={`featured-notes-${request.id}`}
                          className={textareaClass}
                          value={notes[request.id] ?? ""}
                          onChange={(event) =>
                            setNotes((previous) => ({
                              ...previous,
                              [request.id]: event.target.value,
                            }))
                          }
                          maxLength={1000}
                          placeholder="Verified payment and approved placement."
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void decide(request, "approve")}
                        disabled={busy || stripeUnpaid}
                        className={buttonClass("primary", "sm")}
                      >
                        {busy ? (
                          <Spinner className="h-3.5 w-3.5" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Approve placement
                      </button>
                      <button
                        type="button"
                        onClick={() => void decide(request, "reject")}
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
                ) : request.status === "approved" ? (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 px-4 py-3">
                    <p className="flex items-center gap-2 text-sm text-amber-900">
                      <Clock3 className="h-4 w-4" />
                      Featured until {formatDate(request.featured_until)}.
                    </p>
                    <button
                      type="button"
                      onClick={() => void removeFeatured(request)}
                      disabled={removingId === request.id}
                      className={buttonClass(
                        "secondary",
                        "sm",
                        "text-rose-600 hover:border-rose-200 hover:text-rose-700",
                      )}
                    >
                      {removingId === request.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove featured
                    </button>
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
