"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
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
import { CoverImageInput } from "@/components/cover-image-input";
import { RichTextEditor } from "@/components/rich-text-editor";
import {
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPE_OPTIONS,
  articleTypeTone,
} from "@/lib/articles";
import { ManualPaymentPanel } from "./manual-payment-panel";
import { formatDate, formatDateTime } from "@/lib/utils";
import type {
  Article,
  ArticleList,
  ArticleType,
  BillingStatus,
  Business,
} from "@/lib/types";

interface ArticleForm {
  title: string;
  summary: string;
  body: string;
  cover_image_url: string;
  article_type: ArticleType;
  event_starts_at: string;
  event_ends_at: string;
}

const EMPTY_FORM: ArticleForm = {
  title: "",
  summary: "",
  body: "",
  cover_image_url: "",
  article_type: "product_update",
  event_starts_at: "",
  event_ends_at: "",
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ArticleManager() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const businessId = Number(params.id);
  const checkoutStatus = searchParams.get("checkout");

  const [business, setBusiness] = useState<Business | null>(null);
  const [billing, setBilling] = useState<BillingStatus | null>(null);
  const [articles, setArticles] = useState<ArticleList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [billingBusy, setBillingBusy] = useState(false);

  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [editing, setEditing] = useState<Article | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(businessId)) {
      setError("Invalid listing.");
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [businessData, billingData, articleData] = await Promise.all([
        api<Business>(`/api/businesses/${businessId}`),
        api<BillingStatus>(`/api/billing/businesses/${businessId}`),
        api<ArticleList>(`/api/businesses/${businessId}/articles/manage`),
      ]);
      setBusiness(businessData);
      setBilling(billingData);
      setArticles(articleData);
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

  useEffect(() => {
    const editId = Number(searchParams.get("edit"));
    if (!Number.isFinite(editId) || !articles) return;
    const article = articles.items.find((item) => item.id === editId);
    if (article && editing?.id !== article.id) {
      beginEdit(article);
    }
  }, [articles, editing?.id, searchParams]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
  }

  function beginCreate() {
    resetForm();
    setNotice("");
    document
      .getElementById("article-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function beginEdit(article: Article) {
    setEditing(article);
    setNotice("");
    setForm({
      title: article.title,
      summary: article.summary ?? "",
      body: article.body,
      cover_image_url: article.cover_image_url ?? "",
      article_type: article.article_type,
      event_starts_at: toLocalInput(article.event_starts_at),
      event_ends_at: toLocalInput(article.event_ends_at),
    });
    document
      .getElementById("article-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!business) return;
    setError("");
    setNotice("");
    if (form.article_type === "event" && !form.event_starts_at) {
      setError("Event updates need a start date and time.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body.trim(),
        cover_image_url: form.cover_image_url.trim() || null,
        article_type: form.article_type,
        event_starts_at:
          form.article_type === "event"
            ? toIso(form.event_starts_at)
            : null,
        event_ends_at:
          form.article_type === "event" ? toIso(form.event_ends_at) : null,
      };
      if (editing) {
        await api<Article>(`/api/articles/${editing.id}`, {
          method: "PATCH",
          body: payload,
        });
        setNotice("Update saved.");
      } else {
        await api<Article>(`/api/businesses/${business.id}/articles`, {
          method: "POST",
          body: payload,
        });
        setNotice("Update published.");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteArticle(article: Article) {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(article.id);
    setError("");
    setNotice("");
    try {
      await api(`/api/articles/${article.id}`, { method: "DELETE" });
      if (editing?.id === article.id) resetForm();
      setNotice("Update deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  async function startCheckout() {
    if (!business) return;
    setBillingBusy(true);
    setError("");
    try {
      const session = await api<{ checkout_url: string }>(
        `/api/billing/businesses/${business.id}/checkout`,
        { method: "POST" },
      );
      window.location.assign(session.checkout_url);
    } catch (err) {
      setError(errorMessage(err));
      setBillingBusy(false);
    }
  }

  async function handleManualSubmitted(message: string) {
    setNotice(message);
    await load();
  }

  async function openPortal() {
    if (!business) return;
    setBillingBusy(true);
    setError("");
    try {
      const session = await api<{ portal_url: string }>(
        `/api/billing/businesses/${business.id}/portal`,
        { method: "POST" },
      );
      window.location.assign(session.portal_url);
    } catch (err) {
      setError(errorMessage(err));
      setBillingBusy(false);
    }
  }

  if (loading) return <PageLoader label="Loading listing updates…" />;

  if (!business || !billing) {
    return (
      <EmptyState
        icon={<Newspaper className="h-5 w-5" />}
        title="Listing not available"
        description={error || "This listing could not be loaded."}
        action={
          <Link href="/dashboard/listings" className={buttonClass("primary", "sm")}>
            Back to my listings
          </Link>
        }
      />
    );
  }

  const canPublish = business.status === "approved" && business.is_paid;
  const canCreate = canPublish;
  const showForm = Boolean(editing) || canCreate;
  const planName = billing.plan_name || "Article subscription";
  const articleItems = articles?.items ?? [];
  const needsBillingAttention = Boolean(
    billing.has_customer &&
      billing.subscription_status &&
      ["past_due", "unpaid", "incomplete", "paused"].includes(
        billing.subscription_status,
      ),
  );

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
              {business.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={business.status} />
              {business.is_paid ? (
                <Badge tone="emerald">
                  <CheckCircle2 className="h-3 w-3" />
                  Paid access
                </Badge>
              ) : billing.article_access_override === "rejected" ? (
                <Badge tone="rose">Subscription disapproved</Badge>
              ) : billing.manual_payment_pending ? (
                <Badge tone="amber">Approval pending</Badge>
              ) : (
                <Badge>No paid access</Badge>
              )}
            </div>
            <p className="mt-2 max-w-xl text-sm text-slate-500">
              Publish product, service, promo, and event updates. Published
              updates appear on your business profile and in the public updates
              directory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {business.status === "approved" ? (
              <Link
                href={`/businesses/${business.slug}`}
                className={buttonClass("secondary", "sm")}
              >
                <ExternalLink className="h-4 w-4" />
                View listing
              </Link>
            ) : null}
            {hasRole(user, "admin") ? (
              <Link
                href={`/admin/businesses/${business.id}`}
                className={buttonClass("ghost", "sm")}
              >
                <CreditCard className="h-4 w-4" />
                Admin subscription
              </Link>
            ) : null}
            <Link
              href={`/articles?business_id=${business.id}`}
              className={buttonClass("ghost", "sm")}
            >
              <Newspaper className="h-4 w-4" />
              Public updates
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
              Stripe checkout completed. The subscription becomes active after
              Stripe confirms payment.
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
          Checkout was cancelled. Your listing has not been subscribed.
        </Alert>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Article subscription
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                {planName} · one subscription per listing
              </p>
            </div>
          </div>
          {billing.is_paid ? (
            <Badge tone="emerald">Active</Badge>
          ) : billing.subscription_status ? (
            <Badge tone="amber">{billing.subscription_status}</Badge>
          ) : (
            <Badge>Inactive</Badge>
          )}
        </div>

        <div className="mt-4">
          {business.status !== "approved" ? (
            <Alert tone="warning">
              This listing is {business.status}. Articles unlock after an admin
              approves the listing.
            </Alert>
          ) : billing.article_access_override === "rejected" ? (
            <Alert tone="warning">
              Article subscription access was disapproved by an admin. Contact
              support or wait for an admin to review the listing again.
            </Alert>
          ) : !billing.stripe_enabled ? (
            <Alert tone="info">
              Online card billing is not configured on this server. Use the
              cash or bank transfer request below to unlock article
              publishing.
            </Alert>
          ) : billing.is_paid ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Your listing can publish updates.
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {billing.current_period_end
                    ? `Current period ends ${formatDate(
                        billing.current_period_end,
                      )}.`
                    : billing.manual_paid_until
                      ? `Manual payment access ends ${formatDate(
                          billing.manual_paid_until,
                        )}.`
                      : "Subscription details are synced from Stripe."}
                </p>
              </div>
              {billing.has_customer ? (
                <button
                  type="button"
                  onClick={() => void openPortal()}
                  disabled={billingBusy}
                  className={buttonClass("secondary", "sm")}
                >
                  {billingBusy ? <Spinner className="h-4 w-4" /> : null}
                  Manage billing
                </button>
              ) : null}
            </div>
          ) : needsBillingAttention ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Your subscription needs attention.
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Update your payment details in the billing portal to restore
                  article publishing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void openPortal()}
                disabled={billingBusy}
                className={buttonClass("primary", "sm")}
              >
                {billingBusy ? <Spinner className="h-4 w-4" /> : null}
                Manage billing
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">
                  Subscribe to unlock article publishing.
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {billing.manual_payment_pending
                    ? "A manual payment is awaiting approval. Online checkout is paused until it is reviewed."
                    : "Payment is handled securely by Stripe. You can manage or cancel through the billing portal."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {billing.has_customer ? (
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    disabled={billingBusy}
                    className={buttonClass("ghost", "sm")}
                  >
                    Manage billing
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void startCheckout()}
                  disabled={billingBusy || billing.manual_payment_pending}
                  className={buttonClass("primary", "sm")}
                >
                  {billingBusy ? <Spinner className="h-4 w-4" /> : null}
                  Start subscription
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <ManualPaymentPanel
        businessId={business.id}
        businessStatus={business.status}
        billing={billing}
        onSubmitted={handleManualSubmitted}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section
            id="article-form"
            className="scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {editing ? "Edit update" : "New update"}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {editing
                    ? "Changes are visible as soon as you save."
                    : "Published updates go live immediately."}
                </p>
              </div>
              {!editing && canCreate ? (
                <button
                  type="button"
                  onClick={beginCreate}
                  className={buttonClass("ghost", "sm")}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset
                </button>
              ) : null}
            </div>

            {!showForm ? (
              <div className="mt-4">
                <Alert tone="warning">
                  {business.status !== "approved"
                    ? "You can publish updates after this listing is approved."
                    : "An active article subscription is required to publish updates."}
                </Alert>
              </div>
            ) : (
              <form onSubmit={saveArticle} className="mt-5 space-y-4">
                <Field label="Title" htmlFor="article-title">
                  <input
                    id="article-title"
                    className={inputClass}
                    value={form.title}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        title: event.target.value,
                      }))
                    }
                    required
                    minLength={3}
                    maxLength={200}
                    placeholder="New product, service, promo, or event"
                  />
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Update type" htmlFor="article-type">
                    <select
                      id="article-type"
                      className={selectClass}
                      value={form.article_type}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          article_type: event.target.value as ArticleType,
                        }))
                      }
                    >
                      {ARTICLE_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <CoverImageInput
                    value={form.cover_image_url || null}
                    onChange={(url) =>
                      setForm((previous) => ({
                        ...previous,
                        cover_image_url: url ?? "",
                      }))
                    }
                  />
                </div>

                {form.article_type === "event" ? (
                  <div className="grid gap-4 rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-2">
                    <Field label="Starts" htmlFor="event-starts">
                      <input
                        id="event-starts"
                        type="datetime-local"
                        className={inputClass}
                        value={form.event_starts_at}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            event_starts_at: event.target.value,
                          }))
                        }
                        required
                      />
                    </Field>
                    <Field label="Ends" htmlFor="event-ends">
                      <input
                        id="event-ends"
                        type="datetime-local"
                        className={inputClass}
                        value={form.event_ends_at}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            event_ends_at: event.target.value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                ) : null}

                <Field
                  label="Summary"
                  htmlFor="article-summary"
                  hint="Optional. Shown on cards and previews."
                >
                  <textarea
                    id="article-summary"
                    className={textareaClass}
                    value={form.summary}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        summary: event.target.value,
                      }))
                    }
                    maxLength={500}
                    placeholder="A short summary of the update"
                  />
                </Field>

                <Field label="Update details">
                  <RichTextEditor
                    value={form.body}
                    onChange={(html) =>
                      setForm((previous) => ({ ...previous, body: html }))
                    }
                    placeholder="Describe the product, service, promo, or event."
                  />
                </Field>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {editing ? (
                    <button
                      type="button"
                      onClick={resetForm}
                      className={buttonClass("ghost", "sm")}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={saving}
                    className={buttonClass("primary", "sm")}
                  >
                    {saving ? <Spinner className="h-4 w-4" /> : null}
                    {editing ? "Save changes" : "Publish update"}
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  Published updates
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {articles?.total ?? 0} update
                  {(articles?.total ?? 0) === 1 ? "" : "s"} for this listing.
                </p>
              </div>
              {canCreate && !editing ? (
                <button
                  type="button"
                  onClick={beginCreate}
                  className={buttonClass("secondary", "sm")}
                >
                  <Plus className="h-4 w-4" />
                  New update
                </button>
              ) : null}
            </div>

            {articleItems.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={<Newspaper className="h-5 w-5" />}
                  title="No updates yet"
                  description={
                    canPublish
                      ? "Publish your first update to share it on your profile and the public directory."
                      : "Subscribe to start publishing updates for this listing."
                  }
                />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-stone-100">
                {articleItems.map((article) => (
                  <li key={article.id} className="py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={articleTypeTone(article.article_type)}>
                            {ARTICLE_TYPE_LABELS[article.article_type]}
                          </Badge>
                          <span className="text-xs text-slate-400">
                            {formatDate(article.published_at)}
                          </span>
                        </div>
                        <h4 className="mt-1.5 font-semibold text-slate-900">
                          {article.title}
                        </h4>
                        {article.summary ? (
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                            {article.summary}
                          </p>
                        ) : null}
                        {article.article_type === "event" &&
                        article.event_starts_at ? (
                          <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDateTime(article.event_starts_at)}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {billing.is_paid ? (
                          <Link
                            href={`/articles/${article.slug}`}
                            className={buttonClass("ghost", "sm")}
                          >
                            View
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => beginEdit(article)}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteArticle(article)}
                          disabled={deletingId === article.id}
                          className={buttonClass(
                            "ghost",
                            "sm",
                            "text-rose-600 hover:bg-rose-50",
                          )}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Publishing checklist
            </h3>
            <ul className="mt-3 space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Listing must be approved.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Subscription must be active.
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Updates are public immediately after publishing.
              </li>
            </ul>
          </div>
          <Alert tone="info">
            If a subscription lapses, existing updates are hidden from the public
            directory until billing is active again.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
