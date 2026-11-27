"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useState } from "react";
import { ArrowRight, ChevronRight, MapPin, Shapes } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { BusinessCard } from "@/components/business-card";
import { CategoryIcon } from "@/components/category-icon";
import {
  accentFor,
  Alert,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import type { Business, BusinessList, Category } from "@/lib/types";

export default function CategoryDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [category, setCategory] = useState<Category | null>(null);
  const [parent, setParent] = useState<Category | null>(null);
  const [children, setChildren] = useState<Category[]>([]);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const detail = await api<Category>(
          `/api/categories/slug/${encodeURIComponent(slug)}`,
        );
        const [list, allCategories] = await Promise.all([
          api<BusinessList>(
            `/api/businesses?category_id=${detail.id}&page_size=12`,
          ),
          api<Category[]>("/api/categories"),
        ]);
        if (!active) return;
        setCategory(detail);
        setParent(
          detail.parent_id
            ? allCategories.find((item) => item.id === detail.parent_id) ?? null
            : null,
        );
        setChildren(
          allCategories.filter((item) => item.parent_id === detail.id),
        );
        setBusinesses(list.items);
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
          icon={<Shapes className="h-5 w-5" />}
          title="Category not found"
          description={error || "This category may have been removed."}
          action={
            <Link href="/categories" className={buttonClass("primary", "sm")}>
              Browse categories
            </Link>
          }
        />
      </div>
    );
  }

  const accent = accentFor(category.id);

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <li>
                <Link
                  href="/"
                  className="transition hover:text-emerald-700"
                >
                  Home
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <li>
                <Link
                  href="/businesses"
                  className="transition hover:text-emerald-700"
                >
                  Business Directory
                </Link>
              </li>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <li>
                <Link
                  href="/categories"
                  className="transition hover:text-emerald-700"
                >
                  All categories
                </Link>
              </li>
              {parent ? (
                <Fragment key={`parent-${parent.id}`}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  <li>
                    <Link
                      href={`/categories/${parent.slug}`}
                      className="transition hover:text-emerald-700"
                    >
                      {parent.name}
                    </Link>
                  </li>
                </Fragment>
              ) : null}
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <li aria-current="page" className="font-medium text-slate-700">
                {category.name}
              </li>
            </ol>
          </nav>
          <div className="mt-6 flex items-start gap-4">
            <span
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${accent.tile}`}
            >
              <CategoryIcon slug={category.slug} className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                {category.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                {category.description ??
                  `Browse approved ${category.name.toLowerCase()} listings across the Philippines.`}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {children.length > 0 ? (
          <div className="mb-10">
            <h2 className="text-lg font-semibold text-slate-900">
              Subcategories
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  {child.name}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Businesses in {category.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {businesses.length} listing{businesses.length === 1 ? "" : "s"}{" "}
              shown
            </p>
          </div>
          <Link
            href={`/businesses?category_id=${category.id}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <MapPin className="h-4 w-4" />
            Narrow by city
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="No listings yet"
              description="There are no approved businesses in this category yet."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}

        <div className="mt-10">
          <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} />
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
