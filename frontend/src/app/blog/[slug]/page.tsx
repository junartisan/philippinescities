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
  UserRound,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import { CITY_POST_TYPE_LABELS, cityPostTypeTone } from "@/lib/blog";
import { formatDate, formatDateTime, isRichText } from "@/lib/utils";
import type { CityPost } from "@/lib/types";

export default function CityPostDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [post, setPost] = useState<CityPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    api<CityPost>(`/api/city-posts/${slug}`)
      .then((data) => {
        if (active) {
          setPost(data);
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

  if (loading) return <PageLoader label="Loading post…" />;

  if (error || !post) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title="Post not found"
          description={
            error || "This post may have been removed or is no longer published."
          }
          action={
            <Link href="/blog" className={buttonClass("primary", "sm")}>
              Browse the city blog
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        All city posts
      </Link>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={cityPostTypeTone(post.post_type)}>
                {CITY_POST_TYPE_LABELS[post.post_type]}
              </Badge>
              {post.blog_category ? (
                <Badge tone="sky">{post.blog_category.name}</Badge>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Published {formatDate(post.published_at)}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {post.title}
            </h1>
            {post.summary ? (
              <p className="mt-3 text-lg leading-8 text-slate-600">
                {post.summary}
              </p>
            ) : null}

            {post.post_type === "event" && post.event_starts_at ? (
              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-800">
                <p className="flex items-center gap-2 font-semibold">
                  <CalendarDays className="h-4 w-4" />
                  {formatDateTime(post.event_starts_at)}
                  {post.event_ends_at
                    ? ` – ${formatDateTime(post.event_ends_at)}`
                    : ""}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-violet-700">
                  <MapPin className="h-3.5 w-3.5" />
                  {post.city.name}
                  {post.city.province ? `, ${post.city.province}` : ""}
                </p>
              </div>
            ) : null}

            {post.cover_image_url ? (
              <div
                role="img"
                aria-label={post.title}
                className="mt-6 h-64 w-full rounded-2xl bg-stone-200 bg-cover bg-center ring-1 ring-black/5"
                style={{ backgroundImage: `url(${post.cover_image_url})` }}
              />
            ) : null}

            {isRichText(post.body) ? (
              <div
                className="rich-text mt-6 text-base leading-8 text-slate-700"
                dangerouslySetInnerHTML={{ __html: post.body }}
              />
            ) : (
              <div className="mt-6 whitespace-pre-line text-base leading-8 text-slate-700">
                {post.body}
              </div>
            )}

            <div className="mt-8 flex items-center gap-3 border-t border-stone-100 pt-5">
              <Avatar
                name={post.author?.full_name ?? "Philippines Cities"}
                seed={post.author?.id ?? post.city.id}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {post.author?.full_name ?? "Philippines Cities editorial desk"}
                </p>
                <p className="text-xs text-slate-500">City blog author</p>
              </div>
            </div>
          </div>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">City</h2>
            <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-800">
              <MapPin className="h-4 w-4 text-emerald-600" />
              {post.city.name}
              {post.city.province ? `, ${post.city.province}` : ""}
            </p>
            {post.city.region ? (
              <p className="mt-1 text-xs text-slate-500">{post.city.region}</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <Link
                href={`/blog?city_id=${post.city.id}`}
                className={buttonClass("secondary", "sm", "w-full")}
              >
                <Newspaper className="h-4 w-4" />
                More from {post.city.name}
              </Link>
              {post.blog_category ? (
                <Link
                  href={`/blog?blog_category_id=${post.blog_category.id}`}
                  className={buttonClass("secondary", "sm", "w-full")}
                >
                  <Newspaper className="h-4 w-4" />
                  More in {post.blog_category.name}
                </Link>
              ) : null}
              <Link
                href={`/businesses?city_id=${post.city.id}`}
                className={buttonClass("ghost", "sm", "w-full")}
              >
                Browse local businesses
              </Link>
            </div>
          </div>

          {post.author ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 text-emerald-600" />
                <h2 className="text-sm font-semibold text-slate-900">Author</h2>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                {post.author.full_name}
              </p>
            </div>
          ) : null}

          <Alert tone="info">
            City blog posts are published by Philippines Cities administrators and are
            separate from paid business updates.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
