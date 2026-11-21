"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Check,
  Clock3,
  CreditCard,
  ExternalLink,
  Landmark,
  RefreshCw,
  ShieldCheck,
  ShieldX,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  buttonClass,
  BusinessLogo,
  Field,
  inputClass,
  PageLoader,
  Spinner,
  StatusBadge,
  textareaClass,
} from "@/components/ui";
import {
  MANUAL_PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  manualPaymentTone,
} from "@/lib/payments";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  BillingStatus,
  Business,
  ManualPayment,
  SubscriptionApprove,
  SubscriptionDisapprove,
} from "@/lib/types";

function toLocalInput(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
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

function subscriptionState(billing: BillingStatus): {
  label: string;
  tone: "stone" | "emerald" | "amber" | "rose";
} {
  if (billing.is_paid) return { label: "Active", tone: "emerald" };
  if (billing.article_access_override === "rejected") {
    return { label: "Disapproved", tone: "rose" };
  }
  if (billing.manual_payment_pending) {
    return { label: "Pending approval", tone: "amber" };
  }
  const latest = billing.latest_manual_payment;
  if (latest?.status === "approved" || billing.article_access_override === "approved") {
    return { label: "Expired", tone: "amber" };
  }
  if (latest?.status === "rejected") return { label: "Rejected", tone: "rose" };
  return { label: "No subscription", tone: "stone" };
}

export default function AdminBusinessSubscriptionPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);
  const [business, setBusiness] = useState<Business | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [paidUntil, setPaidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<"approve" | "disapprove" | "reset" | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!Number.isFinite(businessId)) {
      setError("Invalid listing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [businessData, billingData, paymentData] = await Promise.all([
        api<Business>(`/api/businesses/${businessId}`),
        api<BillingStatus>(`/api/billing/businesses/${businessId}`),
        api<ManualPayment[]>(
          `/api/billing/businesses/${businessId}/manual-payments`,
        ),
      ]);
      setBusiness(businessData);
      setBilling(billingData);
      setPayments(paymentData);
      setPaidUntil(
        billingData.manual_paid_until
          ? toLocalInput(billingData.manual_paid_until)
          : defaultPaidUntil(),
      );
      setNotes(billingData.article_access_notes ?? "");
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function approve() {
    const iso = toIso(paidUntil);
    if (!iso) {
      setError("Enter a valid paid-until date and time.");
      return;
    }
    setBusy("approve");
    setError("");
    setNotice("");
    try {
      const payload: SubscriptionApprove = {
        paid_until: iso,
        admin_notes: notes.trim() || null,
      };
      await api<Business>(
        `/api/admin/businesses/${businessId}/subscription/approve`,
        { method: "POST", body: payload },
      );
      setNotice(
        "Subscription approved. The listing can publish articles until the selected date.",
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function disapprove() {
    if (
      !window.confirm(
        "Disapprove this subscription? Article publishing and public updates will be locked. Stripe billing is not cancelled automatically.",
      )
    ) {
      return;
    }
    setBusy("disapprove");
    setError("");
    setNotice("");
    try {
      const payload: SubscriptionDisapprove = {
        admin_notes: notes.trim() || null,
      };
      await api<Business>(
        `/api/admin/businesses/${businessId}/subscription/disapprove`,
        { method: "POST", body: payload },
      );
      setNotice("Subscription disapproved. Article access is now locked.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    setBusy("reset");
    setError("");
    setNotice("");
    try {
      await api<Business>(
        `/api/admin/businesses/${businessId}/subscription/reset`,
        { method: "POST", body: {} },
      );
      setNotice("Admin subscription override cleared.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <PageLoader label="Loading listing subscription…" />;
  }

  if (!business || !billing) {
    return <Alert>{error || "Listing not found."}</Alert>;
  }

  const state = subscriptionState(billing);
  const latest = billing.latest_manual_payment;
  const isApproved = business.status === "approved";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/businesses"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-violet-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to listings
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-4">
            <BusinessLogo
              name={business.name}
              seed={business.id}
              logoUrl={business.logo_url}
            />
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-slate-900">
                {business.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={business.status} />
                <Badge tone={state.tone}>{state.label}</Badge>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {business.category.name} · {business.city.name}
                {business.owner ? ` · ${business.owner.full_name}` : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/businesses/${business.slug}`}
              className={buttonClass("secondary", "sm")}
            >
              <ExternalLink className="h-4 w-4" />
              View listing
            </Link>
            <Link
              href={`/dashboard/listings/${business.id}/articles`}
              className={buttonClass("ghost", "sm")}
            >
              Listing dashboard
            </Link>
          </div>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Article subscription
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  Approve or disapprove article access for this listing.
                </p>
              </div>
            </div>
            <Badge tone={state.tone}>{state.label}</Badge>
          </div>

          <dl className="mt-5 grid gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-slate-400">Stripe subscription</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {billing.subscription_status ?? "None"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Stripe period ends</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {formatDate(billing.current_period_end)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Manual access ends</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {formatDate(billing.manual_paid_until)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Admin decision</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {billing.article_access_override ?? "Follow payment status"}
              </dd>
            </div>
          </dl>

          {billing.article_access_notes ? (
            <p className="mt-3 rounded-xl bg-violet-50 px-3.5 py-2.5 text-sm text-violet-800">
              Admin note: {billing.article_access_notes}
            </p>
          ) : null}

          {billing.article_access_override === "rejected" ? (
            <div className="mt-4">
              <Alert tone="warning">
                Article access is locked for this listing. Disapproving does not
                cancel an active Stripe subscription; cancel it in Stripe if
                needed.
              </Alert>
            </div>
          ) : null}

          {latest ? (
            <div className="mt-4 rounded-xl border border-stone-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  {latest.method === "cash" ? (
                    <Banknote className="h-4 w-4 text-amber-600" />
                  ) : (
                    <Landmark className="h-4 w-4 text-amber-600" />
                  )}
                  Latest manual payment
                </p>
                <Badge tone={manualPaymentTone(latest.status)}>
                  {MANUAL_PAYMENT_STATUS_LABELS[latest.status]}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {PAYMENT_METHOD_LABELS[latest.method]} ·{" "}
                {latest.reference || "No reference"} ·{" "}
                {formatDateTime(latest.created_at)}
              </p>
              {latest.notes ? (
                <p className="mt-2 text-sm text-slate-600">
                  Owner notes: {latest.notes}
                </p>
              ) : null}
              {latest.admin_notes ? (
                <p className="mt-1 text-sm text-violet-700">
                  Admin note: {latest.admin_notes}
                </p>
              ) : null}
              {billing.manual_payment_pending ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Approving the subscription will also approve this pending
                  payment request.
                </p>
              ) : null}
            </div>
          ) : null}

          {!isApproved ? (
            <div className="mt-4">
              <Alert tone="warning">
                Approve this listing before approving its subscription.
              </Alert>
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Approve access until"
                htmlFor="admin-paid-until"
                hint="Default is 30 days from now."
              >
                <input
                  id="admin-paid-until"
                  type="datetime-local"
                  className={inputClass}
                  value={paidUntil}
                  onChange={(event) => setPaidUntil(event.target.value)}
                />
              </Field>
              <Field
                label="Admin notes"
                htmlFor="admin-subscription-notes"
                hint="Shown to the business owner."
              >
                <textarea
                  id="admin-subscription-notes"
                  className={textareaClass}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={1000}
                  placeholder="Payment verified by admin."
                />
              </Field>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void approve()}
                disabled={busy !== null || !isApproved}
                className={buttonClass("primary", "sm")}
              >
                {busy === "approve" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <ShieldCheck className="h-3.5 w-3.5" />
                )}
                Approve subscription
              </button>
              <button
                type="button"
                onClick={() => void disapprove()}
                disabled={busy !== null}
                className={buttonClass(
                  "secondary",
                  "sm",
                  "text-rose-600 hover:border-rose-200 hover:text-rose-700",
                )}
              >
                {busy === "disapprove" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : (
                  <ShieldX className="h-3.5 w-3.5" />
                )}
                Disapprove subscription
              </button>
              {billing.article_access_override ? (
                <button
                  type="button"
                  onClick={() => void reset()}
                  disabled={busy !== null}
                  className={buttonClass("ghost", "sm")}
                >
                  {busy === "reset" ? (
                    <Spinner className="h-3.5 w-3.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Use payment status
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Payment history
            </h3>
            <Link
              href="/admin/payments"
              className="text-xs font-semibold text-violet-700 hover:text-violet-800"
            >
              Review all
            </Link>
          </div>
          {payments.length === 0 ? (
            <div className="mt-4 rounded-xl bg-stone-50 px-4 py-6 text-center text-sm text-slate-500">
              No manual payment requests yet.
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {payments.map((payment) => (
                <li key={payment.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
                      {payment.method === "cash" ? (
                        <Banknote className="h-3.5 w-3.5 text-slate-400" />
                      ) : (
                        <Landmark className="h-3.5 w-3.5 text-slate-400" />
                      )}
                      {PAYMENT_METHOD_LABELS[payment.method]}
                    </p>
                    <Badge tone={manualPaymentTone(payment.status)}>
                      {MANUAL_PAYMENT_STATUS_LABELS[payment.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {payment.reference || "No reference"} ·{" "}
                    {formatDate(payment.created_at)}
                  </p>
                  {payment.status === "pending" ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-amber-700">
                      <Clock3 className="h-3 w-3" />
                      Awaiting review
                    </p>
                  ) : null}
                  {payment.status === "approved" ? (
                    <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                      <Check className="h-3 w-3" />
                      Paid until {formatDate(payment.paid_until)}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
