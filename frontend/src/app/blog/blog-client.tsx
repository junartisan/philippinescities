"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin, Newspaper, PenLine, RotateCcw, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { CityPostCard } from "@/components/city-post-card";
import {
  Alert,
  buttonClass,
  EmptyState,
  inputClass,
  Pagination,
  selectClass,
  Spinner,
} from "@/components/ui";
import { CITY_POST_TYPE_OPTIONS } from "@/lib/blog";
import { cn } from "@/lib/utils";
import type { BlogCategory, City, CityPostList } from "@/lib/types";

interface Filters {
  search: string;
  cityId: string;
  categoryId: string;
  type: string;
  page: number;
}

const PAGE_SIZE = 6;

export function BlogClient() {
  const searchParams = useSearchParams();
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("search") ?? "",
    cityId: searchParams.get("city_id") ?? "",
    categoryId: searchParams.get("blog_category_id") ?? "",
    type: searchParams.get("type") ?? "",
    page: Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
  }));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [data, setData] = useState<CityPostList | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api<City[]>("/api/cities"),
      api<BlogCategory[]>("/api/blog-categories"),
    ])
      .then(([cityData, categoryData]) => {
        if (!active) return;
        setCities(cityData);
        setCategories(categoryData);
      })
      .catch(() => {
        if (!active) return;
        setCities([]);
        setCategories([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.cityId) params.set("city_id", filters.cityId);
    if (filters.categoryId) {
      params.set("blog_category_id", filters.categoryId);
    }
    if (filters.type) params.set("type", filters.type);
    params.set("page", String(filters.page));
    params.set("page_size", String(PAGE_SIZE));

    const isFirstPage = filters.page === 1;
    window.history.replaceState(
      null,
      "",
      `/blog${filters.page > 1 || filters.search || filters.cityId || filters.categoryId || filters.type ? `?${params.toString()}` : ""}`,
    );

    if (isFirstPage) setLoading(true);
    else setLoadingMore(true);
    setError("");

    api<CityPostList>(`/api/city-posts?${params.toString()}`)
      .then((result) => {
        if (!active) return;
        setData((previous) =>
          isFirstPage || !previous
            ? result
            : {
                ...result,
                items: [...previous.items, ...result.items],
              },
        );
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
        setLoadingMore(false);
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
    setFilters({
      search: "",
      cityId: "",
      categoryId: "",
      type: "",
      page: 1,
    });
  }

  const selectedCity = cities.find((city) => String(city.id) === filters.cityId);
  const hasFilters = Boolean(
    filters.search || filters.cityId || filters.categoryId || filters.type,
  );

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-4 px-4 py-12">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <Newspaper className="h-4 w-4" />
              Philippines Cities editorial desk
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {selectedCity ? `${selectedCity.name} blog` : "City blog"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              {selectedCity
                ? `Articles, guides, and events from ${selectedCity.name}${
                    selectedCity.province ? `, ${selectedCity.province}` : ""
                  }.`
                : "Articles, guides, and events published by the Philippines Cities team for cities across the Philippines."}
            </p>
          </div>
          <Link href="/contributor" className={buttonClass("secondary", "sm")}>
            <PenLine className="h-4 w-4" />
            Write for the city blog
          </Link>
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
                placeholder="Search city articles and events"
                aria-label="Search city blog"
              />
            </div>
            <select
              aria-label="Filter by city"
              className={cn(selectClass, "lg:w-56")}
              value={filters.cityId}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  cityId: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                  {city.province ? `, ${city.province}` : ""}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by blog category"
              className={cn(selectClass, "lg:w-48")}
              value={filters.categoryId}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  categoryId: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by post type"
              className={cn(selectClass, "lg:w-44")}
              value={filters.type}
              onChange={(event) =>
                setFilters((previous) => ({
                  ...previous,
                  type: event.target.value,
                  page: 1,
                }))
              }
            >
              <option value="">All post types</option>
              {CITY_POST_TYPE_OPTIONS.map((option) => (
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
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                {selectedCity
                  ? `Showing posts for ${selectedCity.name}.`
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

        <div className="mt-8 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent posts</h2>
            <p className="mt-1 text-xs text-slate-500">
              {data ? `Showing ${data.items.length} of ${data.total} posts.` : "Latest city guides, stories, and events."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((post) => (
            <CityPostCard key={`${post.id}-${post.slug}`} post={post} />
          ))}
        </div>

        {loading || loadingMore ? (
          <div className="mt-8 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
              <Spinner className="h-4 w-4" />
              {loading ? "Loading articles..." : "Loading more articles..."}
            </div>
          </div>
        ) : null}

        {!loading && (data?.items.length ?? 0) > 0 ? (
          <div className="mt-8">
            <AdSlot
              slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BLOG_LIST}
              minHeight={140}
            />
          </div>
        ) : null}

        {!loading && data && data.items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Newspaper className="h-5 w-5" />}
              title="No posts found"
              description="Try another city, post type, or search term. New city articles and events will appear here."
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
                    Check back soon for city stories and events.
                  </span>
                )
              }
            />
          </div>
        ) : null}

        {!loading && data && data.page < data.pages ? (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              className={buttonClass("secondary")}
              disabled={loadingMore}
              onClick={() =>
                setFilters((previous) => ({ ...previous, page: previous.page + 1 }))
              }
            >
              {loadingMore ? <Spinner className="h-4 w-4" /> : null}
              Load more articles
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
