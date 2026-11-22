"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Newspaper, RotateCcw, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { ArticleCard } from "@/components/article-card";
import {
  Alert,
  buttonClass,
  EmptyState,
  inputClass,
  Pagination,
  selectClass,
  SkeletonCard,
} from "@/components/ui";
import { ARTICLE_TYPE_OPTIONS } from "@/lib/articles";
import { cn } from "@/lib/utils";
import type { ArticleList } from "@/lib/types";

interface Filters {
  search: string;
  type: string;
  businessId: string;
  page: number;
}

const PAGE_SIZE = 12;

export function ArticlesClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("search") ?? "",
    type: searchParams.get("type") ?? "",
    businessId: searchParams.get("business_id") ?? "",
    page: Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
  }));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [data, setData] = useState<ArticleList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.type) params.set("type", filters.type);
    if (filters.businessId) params.set("business_id", filters.businessId);
    params.set("page", String(filters.page));
    params.set("page_size", String(PAGE_SIZE));
    window.history.replaceState(null, "", `/articles?${params.toString()}`);

    setLoading(true);
    setError("");
    api<ArticleList>(`/api/articles?${params.toString()}`)
      .then((result) => {
        if (active) setData(result);
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
  }, [filters]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((previous) => ({
      ...previous,
      search: searchInput.trim(),
      page: 1,
    }));
  }

  function resetFilters() {
    setSearchInput("");
    setFilters({ search: "", type: "", businessId: "", page: 1 });
  }

  const hasFilters = Boolean(
    filters.search || filters.type || filters.businessId,
  );

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Newspaper className="h-4 w-4" />
            From paid listings
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Business Update
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            New products, service changes, promos, and events published by
            approved businesses with an active article subscription.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8">
        <form
          onSubmit={handleSearch}
          className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className={cn(inputClass, "pl-9")}
                placeholder="Search updates, products, promos, or businesses"
                aria-label="Search business updates"
              />
            </div>
            <select
              aria-label="Filter by update type"
              className={cn(selectClass, "lg:w-52")}
              value={filters.type}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  type: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All update types</option>
              {ARTICLE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass("primary")}>
              Search
            </button>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
              <p className="text-xs text-slate-500">
                {filters.businessId
                  ? "Showing updates from one business."
                  : "Filters are active."}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset filters
              </button>
            </div>
          ) : null}
        </form>

        {error ? (
          <div className="mt-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))
            : (data?.items ?? []).map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
        </div>

        {!loading && (data?.items.length ?? 0) > 0 ? (
          <div className="mt-8">
            <AdSlot
              slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_ARTICLE_LIST}
              minHeight={140}
            />
          </div>
        ) : null}

        {!loading && data && data.items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Newspaper className="h-5 w-5" />}
              title="No updates found"
              description="Try a different search or update type. Businesses publish updates after their listing is approved and subscribed."
              action={
                hasFilters ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className={buttonClass("secondary", "sm")}
                  >
                    Reset filters
                  </button>
                ) : (
                  <span className="text-xs text-slate-400">
                    Check back soon for new business updates.
                  </span>
                )
              }
            />
          </div>
        ) : null}

        <div className="mt-10">
          <Pagination
            page={filters.page}
            pages={data?.pages ?? 1}
            onChange={(page) => {
              setFilters((previous) => ({ ...previous, page }));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </section>
    </div>
  );
}
