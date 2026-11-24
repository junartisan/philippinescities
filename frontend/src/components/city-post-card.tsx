import Link from "next/link";
import { CalendarDays, MapPin, UserRound } from "lucide-react";
import { Badge } from "@/components/ui";
import { CITY_POST_TYPE_LABELS, cityPostTypeTone } from "@/lib/blog";
import { formatDate, formatDateTime, plainText } from "@/lib/utils";
import type { CityPost } from "@/lib/types";

function excerpt(post: CityPost): string {
  const text = post.summary || plainText(post.body);
  return text.length > 170 ? `${text.slice(0, 167).trimEnd()}…` : text;
}

export function CityPostCard({ post }: { post: CityPost }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
      <Link href={`/blog/${post.slug}`} className="block" aria-label={post.title}>
        {post.cover_image_url ? (
          <div
            role="img"
            aria-label={post.title}
            className="h-40 w-full bg-stone-200 bg-cover bg-center"
            style={{ backgroundImage: `url(${post.cover_image_url})` }}
          />
        ) : null}
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={cityPostTypeTone(post.post_type)}>
            {CITY_POST_TYPE_LABELS[post.post_type]}
          </Badge>
          {post.blog_category ? (
            <Link
              href={`/blog/categories/${post.blog_category.slug}`}
              className="rounded-full transition hover:opacity-80"
            >
              <Badge tone="sky">{post.blog_category.name}</Badge>
            </Link>
          ) : null}
          <span className="text-xs text-slate-400">
            {formatDate(post.published_at)}
          </span>
        </div>

        <h3 className="mt-3 line-clamp-2 text-lg font-semibold tracking-tight text-slate-900">
          <Link
            href={`/blog/${post.slug}`}
            className="transition group-hover:text-emerald-700"
          >
            {post.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-slate-500">
          {excerpt(post)}
        </p>

        {post.post_type === "event" && post.event_starts_at ? (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700">
            <CalendarDays className="h-3.5 w-3.5" />
            {formatDateTime(post.event_starts_at)}
          </p>
        ) : null}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-emerald-600" />
            {post.city ? (
              <>
                {post.city.name}
                {post.city.province ? `, ${post.city.province}` : ""}
              </>
            ) : (
              "All Philippines"
            )}
          </span>
          {post.author ? (
            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
              <UserRound className="h-3.5 w-3.5" />
              {post.author.full_name}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
