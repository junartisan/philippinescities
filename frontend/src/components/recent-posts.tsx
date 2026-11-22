"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { api } from "@/lib/api";
import { Spinner } from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { CityPost, CityPostList } from "@/lib/types";

export function RecentPosts({ excludeSlug }: { excludeSlug: string }) {
  const [posts, setPosts] = useState<CityPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<CityPostList>("/api/city-posts?page=1&page_size=6")
      .then((data) => {
        if (!active) return;
        setPosts(data.items.filter((post) => post.slug !== excludeSlug).slice(0, 5));
      })
      .catch(() => {
        if (active) setPosts([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [excludeSlug]);

  if (!loading && posts.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Newspaper className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-900">Recent posts</h2>
      </div>
      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Loading recent posts…
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-stone-100">
          {posts.map((post) => (
            <li key={post.id} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={`/blog/${post.slug}`}
                className="line-clamp-2 text-sm font-medium leading-5 text-slate-800 transition hover:text-emerald-700"
              >
                {post.title}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                {post.blog_category ? (
                  <Link
                    href={`/blog/categories/${post.blog_category.slug}`}
                    className="text-sky-700 hover:text-sky-900 hover:underline"
                  >
                    {post.blog_category.name}
                  </Link>
                ) : null}
                <span>{formatDate(post.published_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
