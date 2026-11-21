"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Newspaper } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui";
import { ARTICLE_TYPE_LABELS, articleTypeTone } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ArticleList, Business } from "@/lib/types";

export function BusinessArticles({ business }: { business: Business }) {
  const [articles, setArticles] = useState<ArticleList | null>(null);

  useEffect(() => {
    if (!business.is_paid) return;
    let active = true;
    api<ArticleList>(`/api/articles?business_id=${business.id}&page_size=4`)
      .then((data) => {
        if (active) setArticles(data);
      })
      .catch(() => {
        if (active) setArticles(null);
      });
    return () => {
      active = false;
    };
  }, [business.id, business.is_paid]);

  if (!business.is_paid || !articles || articles.items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold text-slate-900">
            Latest updates
          </h2>
        </div>
        <Link
          href={`/articles?business_id=${business.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
        >
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <ul className="mt-4 divide-y divide-stone-100">
        {articles.items.map((article) => (
          <li key={article.id} className="py-3 first:pt-0 last:pb-0">
            <Link
              href={`/articles/${article.slug}`}
              className="group flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between"
            >
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={articleTypeTone(article.article_type)}>
                    {ARTICLE_TYPE_LABELS[article.article_type]}
                  </Badge>
                  <span className="text-xs text-slate-400">
                    {formatDate(article.published_at)}
                  </span>
                </span>
                <span className="mt-1.5 block font-medium text-slate-800 group-hover:text-emerald-700">
                  {article.title}
                </span>
                {article.summary ? (
                  <span className="mt-1 block line-clamp-2 text-sm leading-6 text-slate-500">
                    {article.summary}
                  </span>
                ) : null}
              </span>
              {article.article_type === "event" && article.event_starts_at ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-violet-700">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDateTime(article.event_starts_at)}
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
