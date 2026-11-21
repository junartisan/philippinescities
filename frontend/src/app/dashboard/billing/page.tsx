"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Newspaper,
  ReceiptText,
  Sparkles,
  Wallet,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  BusinessLogo,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import {
  FEATURED_PAYMENT_METHOD_LABELS,
  FEATURED_PAYMENT_STATUS_LABELS,
  FEATURED_REQUEST_STATUS_LABELS,
  MANUAL_PAYMENT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  featuredPaymentTone,
  manualPaymentTone,
  type PaymentTone,
} from "@/lib/payments";
import { formatDate } from "@/lib/utils";
import type {
  AccountBilling,
  AccountBillingBusiness,
  ManualPayment,
  FeaturedRequest,
} from "@/lib/types";

interface PaymentHistoryEntry {
  key: string;
  label: string;
  method: string;
  status: string;
  tone: PaymentTone;
  reference: string | null;
  date: string;
  validUntil: string | null;
  requestStatus?: string;
}

function historyEntries(item: AccountBillingBusiness): PaymentHistoryEntry[] {
  const entries: PaymentHistoryEntry[] = [
    ...item.manual_payments.map((payment: ManualPayment) => ({
      key: `manual-${payment.id}`,
      label: "Article subscription",
      method: PAYMENT_METHOD_LABELS[payment.method],
      status: MANUAL_PAYMENT_STATUS_LABELS[payment.status],
      tone: manualPaymentTone(payment.status),
      reference: payment.reference,
      date: payment.created_at,
      validUntil: payment.paid_until,
    })),
    ...item.featured_requests.map((request: FeaturedRequest) => ({
      key: `featured-${request.id}`,
      label: "Featured placement",
      method: FEATURED_PAYMENT_METHOD_LABELS[request.payment_method],
      status: FEATURED_PAYMENT_STATUS_LABELS[request.payment_status],
      tone: featuredPaymentTone(request.payment_status),
      reference: request.payment_reference,
      date: request.created_at,
      validUntil: request.featured_until,
      requestStatus: FEATURED_REQUEST_STATUS_LABELS[request.status],
    })),
  ];
  return entries.sort(
    (left, right) =>
      new Date(right.date).getTime() - new Date(left.date).getTime(),
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {label}
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          {icon}
        </span>
      </div>
    </div>
  );
}

export default function BillingAccountPage() {
  const [account, setAccount] = useState<AccountBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [portalBusy, setPortalBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<AccountBilling>("/api/billing/account");
      setAccount(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPortal(businessId: number) {
    setPortalBusy(businessId);
    setError("");
    try {
      const session = await api<{ portal_url: string }>(
        `/api/billing/businesses/${businessId}/portal`,
        { method: "POST" },
      );
      window.location.assign(session.portal_url);
    } catch (err) {
      setError(errorMessage(err));
      setPortalBusy(null);
    }
  }

  if (loading) return <PageLoader label="Loading billing details…" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Billing & payments
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Review article subscriptions, featured placements, and payment
            history for your listings. Card details and invoices are handled
            securely by Stripe.
          </p>
        </div>
        <Link
          href="/dashboard/listings"
          className={buttonClass("secondary", "sm")}
        >
          <ArrowRight className="h-4 w-4" />
          Manage listings
        </Link>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {!account || account.businesses.length === 0 ? (
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="No billing activity yet"
          description="Add a business listing to subscribe to article access or request a featured placement."
          action={
            <Link
              href="/dashboard/listings/new"
              className={buttonClass("primary", "sm")}
            >
              Add a listing
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Article subscriptions"
              value={account.active_article_subscriptions}
              detail="Active paid listings"
              icon={<Newspaper className="h-4 w-4" />}
            />
            <SummaryCard
              label="Featured listings"
              value={account.active_featured_listings}
              detail="Active placements"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <SummaryCard
              label="Pending payments"
              value={account.pending_payments}
              detail="Awaiting confirmation"
              icon={<Clock3 className="h-4 w-4" />}
            />
            <SummaryCard
              label="Stripe profile"
              value={account.has_stripe_customer ? "Connected" : "Not set up"}
              detail={
                account.has_stripe_customer
                  ? "Cards and invoices managed by Stripe"
                  : "Start a card subscription to connect"
              }
              icon={<CreditCard className="h-4 w-4" />}
            />
          </div>

          <Alert tone="info">
            <div className="flex items-start gap-2">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                This account does not store card numbers. Stripe manages card
                details, receipts, and subscription invoices. Cash and bank
                transfer payments are recorded against each listing after admin
                review.
              </span>
            </div>
          </Alert>

          <div className="space-y-5">
            {account.businesses.map((item) => {
              const articlePaidThrough =
                item.article.current_period_end ??
                item.article.manual_paid_until;
              const articleTone = item.article.is_paid
                ? "emerald"
                : item.article.manual_payment_pending
                  ? "amber"
                  : "stone";
              const articleStatus = item.article.is_paid
                ? "Active"
                : item.article.manual_payment_pending
                  ? "Payment pending"
                  : "Inactive";
              const entries = historyEntries(item);
              const featuredPending = item.featured.pending_request;

              return (
                <article
                  key={item.business.id}
                  className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 p-5">
                    <div className="flex min-w-0 items-start gap-3">
                      <BusinessLogo
                        name={item.business.name}
                        seed={item.business.id}
                        logoUrl={item.business.logo_url}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`/businesses/${item.business.slug}`}
                          className="inline-flex items-center gap-1.5 text-base font-semibold text-slate-900 hover:text-emerald-700"
                        >
                          {item.business.name}
                          <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.business.category.name} ·{" "}
                          {item.business.city.name}
                        </p>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/listings/${item.business.id}/articles`}
                      className={buttonClass("secondary", "sm")}
                    >
                      Manage listing
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>

                  <div className="grid gap-4 p-5 md:grid-cols-2">
                    <section className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm">
                            <Newspaper className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Article subscription
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {account.article_plan_name}
                            </p>
                          </div>
                        </div>
                        <Badge tone={articleTone}>{articleStatus}</Badge>
                      </div>

                      <dl className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Paid through</dt>
                          <dd className="font-medium text-slate-800">
                            {formatDate(articlePaidThrough)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Stripe status</dt>
                          <dd className="font-medium capitalize text-slate-800">
                            {item.article.subscription_status ?? "No subscription"}
                          </dd>
                        </div>
                        {item.article.article_access_notes ? (
                          <div className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                            {item.article.article_access_notes}
                          </div>
                        ) : null}
                      </dl>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/dashboard/listings/${item.business.id}/articles`}
                          className={buttonClass("primary", "sm")}
                        >
                          <Newspaper className="h-3.5 w-3.5" />
                          Manage updates
                        </Link>
                        {account.has_stripe_customer &&
                        account.article_stripe_enabled ? (
                          <button
                            type="button"
                            onClick={() => void openPortal(item.business.id)}
                            disabled={portalBusy === item.business.id}
                            className={buttonClass("secondary", "sm")}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            {portalBusy === item.business.id
                              ? "Opening…"
                              : "Manage card & invoices"}
                          </button>
                        ) : null}
                      </div>
                    </section>

                    <section className="rounded-xl border border-stone-200 bg-stone-50/70 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-amber-600 shadow-sm">
                            <Sparkles className="h-4 w-4" />
                          </span>
                          <div>
                            <h3 className="text-sm font-semibold text-slate-900">
                              Featured placement
                            </h3>
                            <p className="mt-0.5 text-xs text-slate-500">
                              {account.featured_plan_name}
                            </p>
                          </div>
                        </div>
                        {item.featured.is_featured ? (
                          <Badge tone="emerald">Active</Badge>
                        ) : featuredPending ? (
                          <Badge tone="amber">Awaiting review</Badge>
                        ) : (
                          <Badge>Not featured</Badge>
                        )}
                      </div>

                      <dl className="mt-4 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Active until</dt>
                          <dd className="font-medium text-slate-800">
                            {formatDate(item.featured.featured_until)}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <dt className="text-slate-500">Latest request</dt>
                          <dd className="font-medium text-slate-800">
                            {item.featured.latest_request
                              ? FEATURED_REQUEST_STATUS_LABELS[
                                  item.featured.latest_request.status
                                ]
                              : "None"}
                          </dd>
                        </div>
                      </dl>

                      <div className="mt-4">
                        <Link
                          href={`/dashboard/listings/${item.business.id}/featured`}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Manage featured placement
                        </Link>
                      </div>
                    </section>
                  </div>

                  <div className="border-t border-stone-200 p-5">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-4 w-4 text-slate-400" />
                      <h3 className="text-sm font-semibold text-slate-900">
                        Payment history
                      </h3>
                    </div>

                    {entries.length === 0 ? (
                      <p className="mt-3 text-sm text-slate-500">
                        No payments recorded for this listing yet.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-stone-100">
                        {entries.map((entry) => (
                          <li
                            key={entry.key}
                            className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-slate-800">
                                  {entry.label}
                                </span>
                                <Badge tone={entry.tone}>{entry.status}</Badge>
                                {entry.requestStatus ? (
                                  <Badge tone="stone">
                                    {entry.requestStatus}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                {entry.method} · Submitted{" "}
                                {formatDate(entry.date)}
                                {entry.reference
                                  ? ` · Ref ${entry.reference}`
                                  : ""}
                              </p>
                            </div>
                            <div className="text-right text-xs">
                              <p className="font-medium text-slate-700">
                                {entry.validUntil
                                  ? `Valid through ${formatDate(entry.validUntil)}`
                                  : "No active period"}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {!account.has_stripe_customer ? (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-5">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Add a card payment method
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Start a card subscription from a listing&apos;s updates
                    page. Stripe will securely collect and store the payment
                    method, then invoices will appear in the Stripe billing
                    portal.
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
