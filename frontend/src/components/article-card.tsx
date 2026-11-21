import Link from "next/link";
import { CalendarDays, Store } from "lucide-react";
import { Badge, BusinessLogo } from "@/components/ui";
import { ARTICLE_TYPE_LABELS, articleTypeTone } from "@/lib/articles";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { Article } from "@/lib/types";

function excerpt(article: Article): string {
  const text = article.summary || article.body.replace(/\s+/g, " ").trim();
  return text.length > 170 ? `${text.slice(0, 167).trimEnd()}…` : text;
}

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/articles/${article.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={articleTypeTone(article.article_type)}>
          {ARTICLE_TYPE_LABELS[article.article_type]}
        </Badge>
        <span className="text-xs text-slate-400">
          {formatDate(article.published_at)}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight text-slate-900 group-hover:text-emerald-700">
        {article.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">
        {excerpt(article)}
      </p>

      {article.article_type === "event" && article.event_starts_at ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700">
          <CalendarDays className="h-3.5 w-3.5" />
          {formatDateTime(article.event_starts_at)}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2.5 border-t border-stone-100 pt-4">
        <BusinessLogo
          name={article.business.name}
          seed={article.business.id}
          logoUrl={article.business.logo_url}
          size="sm"
        />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-sm font-medium text-slate-700">
            <Store className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{article.business.name}</span>
          </span>
          <span className="block truncate text-xs text-slate-400">
            {article.business.category.name} · {article.business.city.name}
          </span>
        </span>
      </div>
    </Link>
  );
}
