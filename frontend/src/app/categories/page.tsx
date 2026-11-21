"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Shapes } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CategoryIcon } from "@/components/category-icon";
import { accentFor, Alert, EmptyState, SkeletonCard } from "@/components/ui";
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

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Categories
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Every listing belongs to a category. Pick one to see the businesses
            that fit, then narrow the results by city.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {error ? (
          <div className="mb-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))
            : categories.map((category) => {
                const accent = accentFor(category.id);
                return (
                  <Link
                    key={category.id}
                    href={`/businesses?category_id=${category.id}`}
                    className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${accent.tile}`}
                      >
                        <CategoryIcon
                          slug={category.slug}
                          className="h-6 w-6"
                        />
                      </span>
                      <ArrowRight className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </div>
                    <h2 className="mt-4 text-base font-semibold text-slate-900 group-hover:text-emerald-700">
                      {category.name}
                    </h2>
                    <p className="mt-1.5 text-sm leading-6 text-slate-500">
                      {category.description ?? "Browse businesses in this category."}
                    </p>
                  </Link>
                );
              })}
        </div>

        {!loading && categories.length === 0 && !error ? (
          <EmptyState
            icon={<Shapes className="h-5 w-5" />}
            title="No categories yet"
            description="An admin needs to create categories before listings can be added."
          />
        ) : null}
      </section>
    </div>
  );
}
