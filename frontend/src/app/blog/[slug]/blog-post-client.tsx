"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Newspaper,
  Pencil,
  Search,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { useAuth } from "@/components/auth-provider";
import { CityPostComments } from "@/components/city-post-comments";
import { RecentPosts } from "@/components/recent-posts";
import { ShareButtons } from "@/components/share-buttons";
import { WriterCredentialCard } from "@/components/writer-credential-card";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
} from "@/components/ui";
import { CITY_POST_TYPE_LABELS, cityPostTypeTone } from "@/lib/blog";
import { formatDate, formatDateTime, isRichText } from "@/lib/utils";
import type { BlogCategory, CityPost } from "@/lib/types";

export default function CityPostDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { user } = useAuth();
  const [post, setPost] = useState<CityPost | null>(null);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    api<CityPost>(`/api/city-posts/${encodeURIComponent(slug)}`)
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

  useEffect(() => {
    let active = true;
    api<BlogCategory[]>("/api/blog-categories")
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {
        if (active) setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleCategorySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = search.trim();
    router.push(q ? `/blog?search=${encodeURIComponent(q)}` : "/blog");
  }

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

  const canEdit =
    user?.role === "admin" ||
    user?.role === "editor" ||
    user?.role === "supervisor" ||
    (user?.role === "contributor" && post.author?.id === user.id);
  const editHref =
    user?.role === "contributor"
      ? `/contributor?edit=${post.id}`
      : `/admin/blog?edit=${post.id}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          All city posts
        </Link>
        {canEdit ? (
          <Link href={editHref} className={buttonClass("secondary", "sm")}>
            <Pencil className="h-4 w-4" />
            Edit post
          </Link>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <article className="lg:col-span-2">
          <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
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
                  {post.city ? (
                    <>
                      {post.city.name}
                      {post.city.province ? `, ${post.city.province}` : ""}
                    </>
                  ) : (
                    "All Philippines"
                  )}
                </p>
              </div>
            ) : null}

            {post.cover_image_url ? (
              <div
                role="img"
                aria-label={`Cover image for ${post.title}`}
                className="mt-6 aspect-[4/3] w-full rounded-2xl bg-stone-200 bg-contain bg-center bg-no-repeat ring-1 ring-black/5 sm:aspect-[16/9]"
                style={{ backgroundImage: `url("${post.cover_image_url}")` }}
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
                seed={post.author?.id ?? post.city?.id ?? post.id}
                size="sm"
              />
              <div>
                <p className="text-sm font-medium text-slate-800">
                  {post.author?.full_name ?? "Philippines Cities editorial desk"}
                </p>
                <p className="text-xs text-slate-500">City blog author</p>
              </div>
            </div>

            <ShareButtons title={post.title} path={`/blog/${post.slug}`} />
          </div>

          <CityPostComments slug={post.slug} />
        </article>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Search blog</h2>
            <form onSubmit={handleCategorySearch} className="mt-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={`${inputClass} pl-9`}
                  placeholder="Search articles..."
                  aria-label="Search blog articles"
                />
              </div>
              <button type="submit" className={buttonClass("primary", "sm", "mt-2 w-full")}>
                Search
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Categories</h2>
            <div className="mt-3 flex flex-col gap-1.5">
              <Link
                href="/blog"
                className="rounded-lg px-2 py-1.5 text-sm text-slate-600 transition hover:bg-stone-50 hover:text-emerald-700"
              >
                All posts
              </Link>
              {categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/blog/categories/${category.slug}`}
                  className={`rounded-lg px-2 py-1.5 text-sm transition hover:bg-stone-50 hover:text-emerald-700 ${
                    post.blog_category?.id === category.id
                      ? "bg-emerald-50 font-medium text-emerald-700"
                      : "text-slate-600"
                  }`}
                >
                  {category.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              {post.city ? "City" : "Coverage"}
            </h2>
            {post.city ? (
              <>
                <Link
                  href={`/cities/${post.city.slug}`}
                  className="mt-3 flex items-center gap-1.5 text-sm font-medium text-slate-800 hover:text-emerald-700"
                >
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  {post.city.name}
                  {post.city.province ? `, ${post.city.province}` : ""}
                </Link>
                {post.city.region ? (
                  <p className="mt-1 text-xs text-slate-500">{post.city.region}</p>
                ) : null}
              </>
            ) : (
              <p className="mt-3 text-sm font-medium text-slate-800">
                All Philippines
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {post.city ? (
                <Link
                  href={`/cities/${post.city.slug}#news`}
                  className={buttonClass("secondary", "sm", "w-full")}
                >
                  <Newspaper className="h-4 w-4" />
                  More from {post.city.name}
                </Link>
              ) : (
                <Link
                  href="/blog"
                  className={buttonClass("secondary", "sm", "w-full")}
                >
                  <Newspaper className="h-4 w-4" />
                  More city blog posts
                </Link>
              )}
              {post.blog_category ? (
                <Link
                  href={`/blog/categories/${post.blog_category.slug}`}
                  className={buttonClass("secondary", "sm", "w-full")}
                >
                  <Newspaper className="h-4 w-4" />
                  More in {post.blog_category.name}
                </Link>
              ) : null}
              {post.city ? (
                <Link
                  href={`/cities/${post.city.slug}#businesses`}
                  className={buttonClass("ghost", "sm", "w-full")}
                >
                  Browse local businesses
                </Link>
              ) : (
                <Link
                  href="/businesses"
                  className={buttonClass("ghost", "sm", "w-full")}
                >
                  Browse businesses
                </Link>
              )}
            </div>
          </div>

          <RecentPosts excludeSlug={post.slug} />

          {post.author ? (
            <WriterCredentialCard
              userId={post.author.id}
              name={post.author.full_name}
            />
          ) : null}

          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG_DETAIL}
            format="rectangle"
            minHeight={250}
          />

          <Alert tone="info">
            City blog posts are published by Philippines Cities administrators and are
            separate from paid business updates.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
