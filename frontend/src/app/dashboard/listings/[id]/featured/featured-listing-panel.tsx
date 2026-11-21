"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Landmark,
  RefreshCw,
  Sparkles,
  XCircle,
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
  selectClass,
  Spinner,
  StatusBadge,
  textareaClass,
} from "@/components/ui";
import {
  FEATURED_PAYMENT_METHOD_LABELS,
  FEATURED_PAYMENT_STATUS_LABELS,
  FEATURED_REQUEST_STATUS_LABELS,
  featuredPaymentTone,
  featuredRequestTone,
} from "@/lib/payments";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  Business,
  FeaturedCheckout,
  FeaturedPaymentMethod,
  FeaturedRequest,
  FeaturedRequestPayload,
  FeaturedStatus,
} from "@/lib/types";

interface FeaturedForm {
  payment_method: FeaturedPaymentMethod;
  message: string;
  payment_reference: string;
  payment_notes: string;
}

const EMPTY_FORM: FeaturedForm = {
  payment_method: "cash",
  message: "",
  payment_reference: "",
  payment_notes: "",
};

export function FeaturedListingPanel() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const businessId = Number(params.id);
  const checkoutStatus = searchParams.get("checkout");

  const [business, setBusiness] = useState<Business | null>(null);
  const [featured, setFeatured] = useState<FeaturedStatus | null>(null);
  const [form, setForm] = useState<FeaturedForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(businessId)) {
      setError("Invalid listing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [businessData, featuredData] = await Promise.all([
        api<Business>(`/api/businesses/${businessId}`),
        api<FeaturedStatus>(`/api/featured/businesses/${businessId}`),
      ]);
      setBusiness(businessData);
      setFeatured(featuredData);
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setError("");
    setNotice("");
    if (
      form.payment_method === "bank_transfer" &&
      !form.payment_reference.trim()
    ) {
      setError("Enter the bank transfer reference number.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: FeaturedRequestPayload = {
        payment_method: form.payment_method,
        message: form.message.trim() || null,
        payment_reference: form.payment_reference.trim() || null,
        payment_notes: form.payment_notes.trim() || null,
      };
      const result = await api<FeaturedRequest | FeaturedCheckout>(
        `/api/featured/businesses/${business.id}/requests`,
        { method: "POST", body: payload },
      );
      if ("checkout_url" in result) {
        window.location.assign(result.checkout_url);
        return;
      }
      setForm(EMPTY_FORM);
      setNotice(
        "Featured listing request submitted. An admin will review the payment and placement.",
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function retryCheckout(request: FeaturedRequest) {
    setCheckoutBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<FeaturedCheckout>(
        `/api/featured/requests/${request.id}/checkout`,
        { method: "POST" },
      );
      window.location.assign(result.checkout_url);
    } catch (err) {
      setError(errorMessage(err));
      setCheckoutBusy(false);
    }
  }

  async function cancelRequest(request: FeaturedRequest) {
    if (!window.confirm("Cancel this featured listing request?")) return;
    setCancelling(true);
    setError("");
    setNotice("");
    try {
      await api(`/api/featured/requests/${request.id}`, { method: "DELETE" });
      setNotice("Featured listing request cancelled.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <PageLoader label="Loading featured listing…" />;

  if (!business || !featured) {
    return (
      <EmptyState
        icon={<Sparkles className="h-5 w-5" />}
        title="Listing not available"
        description={error || "This listing could not be loaded."}
        action={
          <Link
            href="/dashboard/listings"
            className={buttonClass("primary", "sm")}
          >
            Back to my listings
          </Link>
        }
      />
    );
  }

  const pending = featured.pending_request;
  const latest = featured.latest_request;
  const canCancel =
    pending &&
    pending.status === "pending" &&
    pending.payment_status === "pending";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/listings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my listings
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Featured listing
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={business.status} />
              {featured.is_featured ? (
                <Badge tone="amber">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </Badge>
              ) : null}
            </div>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Featured listings appear first in directory results for their city
              and category. Placement requires payment and admin approval.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/businesses/${business.slug}`}
              className={buttonClass("secondary", "sm")}
            >
              <ExternalLink className="h-4 w-4" />
              View listing
            </Link>
          </div>
        </div>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {checkoutStatus === "success" ? (
        <Alert tone="info">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Stripe checkout completed. Your payment will appear as paid once
              Stripe confirms it, then an admin can approve the placement.
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className={buttonClass("secondary", "sm")}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh status
            </button>
          </div>
        </Alert>
      ) : null}
      {checkoutStatus === "cancelled" ? (
        <Alert tone="warning">
          Checkout was cancelled. Your featured listing request is still
          awaiting payment.
        </Alert>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {featured.is_featured
                  ? "Featured placement active"
                  : pending
                    ? "Featured request in progress"
                    : "Request a featured placement"}
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {featured.is_featured
                  ? `Active until ${formatDate(featured.featured_until)}.`
                  : pending
                    ? "Your request is being reviewed by an admin."
                    : "Choose how you want to pay, then submit for admin review."}
              </p>
            </div>
          </div>
          {featured.is_featured ? (
            <Badge tone="emerald">Active</Badge>
          ) : pending ? (
            <Badge tone="amber">Awaiting review</Badge>
          ) : (
            <Badge>Not featured</Badge>
          )}
        </div>

        {business.status !== "approved" ? (
          <div className="mt-4">
            <Alert tone="warning">
              This listing is {business.status}. Featured placement is available
              after an admin approves the listing.
            </Alert>
          </div>
        ) : featured.is_featured ? (
          <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Your business is featured in {business.city.name} for{" "}
              {business.category.name}.
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Placement ends {formatDate(featured.featured_until)}. Contact
              support if you need the expiry changed.
            </p>
          </div>
        ) : pending ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" />
              {pending.status === "pending"
                ? "Your featured listing request is awaiting review."
                : "This request has been reviewed."}
            </p>
            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-amber-700">Payment method</dt>
                <dd className="font-medium">
                  {FEATURED_PAYMENT_METHOD_LABELS[pending.payment_method]}
                </dd>
              </div>
              <div>
                <dt className="text-amber-700">Payment status</dt>
                <dd className="font-medium">
                  {FEATURED_PAYMENT_STATUS_LABELS[pending.payment_status]}
                </dd>
              </div>
              <div>
                <dt className="text-amber-700">Reference</dt>
                <dd className="font-medium">
                  {pending.payment_reference || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-amber-700">Submitted</dt>
                <dd className="font-medium">
                  {formatDateTime(pending.created_at)}
                </dd>
              </div>
            </dl>
            {pending.message ? (
              <p className="mt-3 text-xs text-amber-800">
                Your message: {pending.message}
              </p>
            ) : null}
            {pending.payment_notes ? (
              <p className="mt-1 text-xs text-amber-800">
                Payment notes: {pending.payment_notes}
              </p>
            ) : null}
            {pending.payment_status === "paid" ? (
              <p className="mt-3 text-xs text-amber-800">
                Payment received. An admin will approve the placement and set
                the expiry date.
              </p>
            ) : pending.payment_method === "stripe" ? (
              <p className="mt-3 text-xs text-amber-800">
                Complete the card payment to send this request to the admin
                review queue.
              </p>
            ) : (
              <p className="mt-3 text-xs text-amber-800">
                An admin will verify your cash or bank transfer before approving
                the placement.
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {pending.payment_method === "stripe" &&
              pending.payment_status === "pending" ? (
                <button
                  type="button"
                  onClick={() => void retryCheckout(pending)}
                  disabled={checkoutBusy}
                  className={buttonClass("primary", "sm")}
                >
                  {checkoutBusy ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  Complete card payment
                </button>
              ) : null}
              {canCancel ? (
                <button
                  type="button"
                  onClick={() => void cancelRequest(pending)}
                  disabled={cancelling}
                  className={buttonClass(
                    "secondary",
                    "sm",
                    "text-rose-600 hover:border-rose-200 hover:text-rose-700",
                  )}
                >
                  {cancelling ? <Spinner className="h-4 w-4" /> : null}
                  Cancel request
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            {latest ? (
              <div className="mt-4">
                {latest.status === "rejected" ? (
                  <Alert tone="warning">
                    <p className="flex items-center gap-2 font-semibold">
                      <XCircle className="h-4 w-4" />
                      Your previous featured listing request was rejected.
                    </p>
                    {latest.admin_notes ? (
                      <p className="mt-1">Admin note: {latest.admin_notes}</p>
                    ) : null}
                    <p className="mt-1">
                      You can submit a new request with updated details.
                    </p>
                  </Alert>
                ) : latest.status === "approved" ? (
                  <Alert tone="info">
                    <p className="flex items-center gap-2 font-semibold">
                      <Clock3 className="h-4 w-4" />
                      Your previous featured placement ended on{" "}
                      {formatDate(latest.featured_until)}.
                    </p>
                    <p className="mt-1">
                      Submit a new request to feature this listing again.
                    </p>
                  </Alert>
                ) : null}
              </div>
            ) : null}

            <form onSubmit={submit} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Payment method"
                  htmlFor="featured-method"
                  hint={
                    featured.stripe_enabled
                      ? "Card payments are confirmed by Stripe."
                      : "Card payments are not configured; use cash or bank transfer."
                  }
                >
                  <select
                    id="featured-method"
                    className={selectClass}
                    value={form.payment_method}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payment_method: event.target
                          .value as FeaturedPaymentMethod,
                      }))
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="stripe" disabled={!featured.stripe_enabled}>
                      Card via Stripe
                    </option>
                  </select>
                </Field>
                <Field
                  label={
                    form.payment_method === "bank_transfer"
                      ? "Bank reference number"
                      : "Receipt or reference"
                  }
                  htmlFor="featured-reference"
                  hint={
                    form.payment_method === "bank_transfer"
                      ? "Required so the admin can match your transfer."
                      : "Optional. Add a receipt number if available."
                  }
                >
                  <input
                    id="featured-reference"
                    className={inputClass}
                    value={form.payment_reference}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        payment_reference: event.target.value,
                      }))
                    }
                    maxLength={255}
                    required={form.payment_method === "bank_transfer"}
                    placeholder={
                      form.payment_method === "bank_transfer"
                        ? "e.g. BPI-2026-00123"
                        : "e.g. OR-1042"
                    }
                  />
                </Field>
              </div>

              <Field
                label="Why should this listing be featured?"
                htmlFor="featured-message"
                hint={`Shown to the admin. Placement applies to ${business.city.name} / ${business.category.name}.`}
              >
                <textarea
                  id="featured-message"
                  className={textareaClass}
                  value={form.message}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      message: event.target.value,
                    }))
                  }
                  maxLength={1000}
                  placeholder="Tell the admin about your business and the placement you want."
                />
              </Field>

              <Field
                label="Payment notes"
                htmlFor="featured-notes"
                hint="Optional. Include the amount, date paid, or other details."
              >
                <textarea
                  id="featured-notes"
                  className={textareaClass}
                  value={form.payment_notes}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      payment_notes: event.target.value,
                    }))
                  }
                  maxLength={2000}
                  placeholder="Paid PHP 1,500 in cash at the office on Nov 16."
                />
              </Field>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 px-4 py-3">
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  {form.payment_method === "cash" ? (
                    <Banknote className="h-4 w-4 text-slate-400" />
                  ) : form.payment_method === "bank_transfer" ? (
                    <Landmark className="h-4 w-4 text-slate-400" />
                  ) : (
                    <CreditCard className="h-4 w-4 text-slate-400" />
                  )}
                  {form.payment_method === "stripe"
                    ? "You will be redirected to Stripe to pay."
                    : "Payment is confirmed manually by an admin."}
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className={buttonClass("primary", "sm")}
                >
                  {submitting ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {form.payment_method === "stripe"
                    ? "Continue to payment"
                    : "Submit for approval"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>

      {latest ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Latest request
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Submitted {formatDateTime(latest.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={featuredRequestTone(latest.status)}>
                {FEATURED_REQUEST_STATUS_LABELS[latest.status]}
              </Badge>
              <Badge tone={featuredPaymentTone(latest.payment_status)}>
                {FEATURED_PAYMENT_STATUS_LABELS[latest.payment_status]}
              </Badge>
            </div>
          </div>
          <dl className="mt-4 grid gap-3 rounded-xl bg-stone-50 px-4 py-3 text-xs sm:grid-cols-3">
            <div>
              <dt className="text-slate-400">Method</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {FEATURED_PAYMENT_METHOD_LABELS[latest.payment_method]}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Reference</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {latest.payment_reference || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Featured until</dt>
              <dd className="mt-0.5 font-medium text-slate-700">
                {formatDate(latest.featured_until)}
              </dd>
            </div>
          </dl>
          {latest.admin_notes ? (
            <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800">
              Admin note: {latest.admin_notes}
            </p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
