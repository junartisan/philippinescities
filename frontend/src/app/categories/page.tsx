"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shapes } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CategoryIcon } from "@/components/category-icon";
import { accentFor, Alert, Badge, EmptyState, SkeletonCard } from "@/components/ui";
import type { Category } from "@/lib/types";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api<Category[]>("/api/categories")
      .then((data) => {
        if (active) setCategories(data);
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
  }, []);

  const { parents, childrenByParent } = useMemo(() => {
    const byParent = new Map<number, Category[]>();
    for (const category of categories) {
      if (category.parent_id === null) continue;
      const children = byParent.get(category.parent_id) ?? [];
      children.push(category);
      byParent.set(category.parent_id, children);
    }
    return {
      parents: categories.filter((category) => category.parent_id === null),
      childrenByParent: byParent,
    };
  }, [categories]);

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Business directory
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Browse categories
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Explore {parents.length} industry groups and their specialist
            categories, then narrow the results by city.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {error ? (
          <div className="mb-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : parents.length === 0 ? (
          <EmptyState
            icon={<Shapes className="h-5 w-5" />}
            title="No categories yet"
            description="An admin needs to create categories before listings can be added."
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {parents.map((category) => {
              const accent = accentFor(category.id);
              const children = childrenByParent.get(category.id) ?? [];
              return (
                <article
                  key={category.id}
                  className="flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:border-emerald-200 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${accent.tile}`}
                    >
                      <CategoryIcon slug={category.slug} className="h-6 w-6" />
                    </span>
                    <Badge tone="stone">
                      {category.business_count} listing
                      {category.business_count === 1 ? "" : "s"}
                    </Badge>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-slate-900">
                    <Link
                      href={`/categories/${category.slug}`}
                      className="hover:text-emerald-700"
                    >
                      {category.name}
                    </Link>
                  </h2>
                  <p className="mt-1.5 text-sm leading-6 text-slate-500">
                    {category.description ?? "Browse businesses in this category."}
                  </p>

                  {children.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5 border-t border-stone-100 pt-4">
                      {children.slice(0, 8).map((child) => (
                        <Link
                          key={child.id}
                          href={`/categories/${child.slug}`}
                          className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-emerald-50 hover:text-emerald-700"
                        >
                          {child.name}
                        </Link>
                      ))}
                      {children.length > 8 ? (
                        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          +{children.length - 8} more
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <Link
                    href={`/categories/${category.slug}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    View category
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
