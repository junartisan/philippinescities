"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Newspaper,
  Pencil,
  UserRound,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { useAuth } from "@/components/auth-provider";
import { ShareButtons } from "@/components/share-buttons";
import {
  Alert,
  Avatar,
  Badge,
  BusinessLogo,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import { ARTICLE_TYPE_LABELS, articleTypeTone } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Article } from "@/lib/types";

export default function ArticleDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user } = useAuth();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    api<Article>(`/api/articles/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (active) {
          setArticle(data);
          setError("");
        }
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
  }, [slug]);

  if (loading) return <PageLoader label="Loading update…" />;

  if (error || !article) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title="Update not found"
          description={
            error ||
            "This update may have been removed, or its listing no longer has an active subscription."
          }
          action={
            <Link href="/articles" className={buttonClass("primary", "sm")}>
              Browse business updates
            </Link>
          }
        />
      </div>
    );
  }

  const canEdit =
    user?.role === "admin" ||
    user?.role === "editor" ||
    user?.role === "supervisor" ||
    article.author?.id === user?.id;
  const editHref = `/dashboard/listings/${article.business_id}/articles?edit=${article.id}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/articles"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All business updates
        </Link>
        {canEdit ? (
          <Link href={editHref} className={buttonClass("secondary", "sm")}>
            <Pencil className="h-4 w-4" />
            Edit update
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={articleTypeTone(article.article_type)}>
                {ARTICLE_TYPE_LABELS[article.article_type]}
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Published {formatDate(article.published_at)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {article.title}
            </h1>
            {article.summary ? (
              <p className="mt-3 text-lg leading-8 text-slate-600">
                {article.summary}
              </p>
            ) : null}

            {article.article_type === "event" && article.event_starts_at ? (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                <p className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="h-4 w-4" />
                  {formatDateTime(article.event_starts_at)}
                  {article.event_ends_at
                    ? ` – ${formatDateTime(article.event_ends_at)}`
                    : ""}
                </p>
              </div>
            ) : null}

            {article.cover_image_url ? (
              <div
                role="img"
                aria-label={article.title}
                className="mt-6 h-64 w-full rounded-2xl bg-stone-200 bg-cover bg-center ring-1 ring-black/5"
                style={{ backgroundImage: `url(${article.cover_image_url})` }}
              />
            ) : null}

            <div className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700">
              {article.body}
            </div>

            <div className="mt-8 flex items-center gap-3 border-t border-stone-100 pt-5">
              <Avatar
                name={article.author?.full_name ?? article.business.name}
                seed={article.author?.id ?? article.business.id}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {article.author?.full_name ?? article.business.name}
                </p>
                <p className="text-xs text-slate-500">
                  {article.author ? "Listing owner" : "Business listing"}
                </p>
              </div>
            </div>

            <ShareButtons
              title={article.title}
              path={`/articles/${article.slug}`}
              heading="Share this update"
            />
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              Published by
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <BusinessLogo
                name={article.business.name}
                seed={article.business.id}
                logoUrl={article.business.logo_url}
                size="md"
              />
              <div className="min-w-0">
                <Link
                  href={`/businesses/${article.business.slug}`}
                  className="block truncate text-sm font-semibold text-slate-900 hover:text-emerald-700"
                >
                  {article.business.name}
                </Link>
                <Link
                  href={`/categories/${article.business.category.slug}`}
                  className="mt-0.5 block text-xs text-slate-500 hover:text-emerald-700"
                >
                  {article.business.category.name}
                </Link>
              </div>
            </div>
            <Link
              href={`/cities/${article.business.city.slug}`}
              className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-700"
            >
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              {article.business.city.name}
              {article.business.city.province
                ? `, ${article.business.city.province}`
                : ""}
            </Link>
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/businesses/${article.business.slug}`}
                className={buttonClass("secondary", "sm", "w-full")}
              >
                View business profile
              </Link>
              <Link
                href={`/articles?business_id=${article.business.id}`}
                className={buttonClass("ghost", "sm", "w-full")}
              >
                <Newspaper className="h-4 w-4" />
                More updates
              </Link>
            </div>
          </div>

          {article.author ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Article author
                </h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {article.author.full_name}
              </p>
            </div>
          ) : null}

          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_DETAIL}
            format="rectangle"
            minHeight={250}
          />

          <Alert tone="info">
            Updates are published by paid business owners and stay public
            while the listing is approved and the subscription is active.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
