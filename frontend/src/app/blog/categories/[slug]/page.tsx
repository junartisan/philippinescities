"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Newspaper } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { CityPostCard } from "@/components/city-post-card";
import {
  Alert,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import type { BlogCategory, CityPost, CityPostList } from "@/lib/types";

export default function BlogCategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [category, setCategory] = useState<BlogCategory | null>(null);
  const [posts, setPosts] = useState<CityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const detail = await api<BlogCategory>(
          `/api/blog-categories/slug/${encodeURIComponent(slug)}`,
        );
        const list = await api<CityPostList>(
          `/api/city-posts?blog_category_id=${detail.id}&page_size=12`,
        );
        if (!active) return;
        setCategory(detail);
        setPosts(list.items);
        setError("");
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) return <PageLoader label="Loading category…" />;

  if (error || !category) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title="Blog category not found"
          description={error || "This category may have been removed."}
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
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            City blog
          </Link>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {category.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {category.description ??
              `Read ${category.name.toLowerCase()} stories from cities across the Philippines.`}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">
          {posts.length} story{posts.length === 1 ? "" : "ies"}
        </h2>

        {posts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Newspaper className="h-5 w-5" />}
              title="No stories yet"
              description="There are no published stories in this category yet."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <CityPostCard key={post.id} post={post} />
            ))}
          </div>
        )}

        <div className="mt-10">
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG_LIST} />
        </div>

        {error ? (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}
      </section>
    </div>
  );
}
