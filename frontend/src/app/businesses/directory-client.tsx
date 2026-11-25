"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronRight, RotateCcw, Search, Store } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { BusinessCard } from "@/components/business-card";
import {
  Alert,
  buttonClass,
  EmptyState,
  inputClass,
  Pagination,
  selectClass,
  SkeletonCard,
} from "@/components/ui";
import { SITE_NAME } from "@/lib/seo";
import { cn } from "@/lib/utils";
import type { BusinessList, Category, City } from "@/lib/types";

interface Filters {
  search: string;
  categoryId: string;
  cityId: string;
  page: number;
}

const PAGE_SIZE = 9;

export function DirectoryClient() {
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("search") ?? "",
    categoryId: searchParams.get("category_id") ?? "",
    cityId: searchParams.get("city_id") ?? "",
    page: Math.max(1, Number(searchParams.get("page") ?? "1") || 1),
  }));
  const [searchInput, setSearchInput] = useState(filters.search);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [data, setData] = useState<BusinessList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        const [categoryList, cityList] = await Promise.all([
          api<Category[]>("/api/categories"),
          api<City[]>("/api/cities"),
        ]);
        if (!active) return;
        setCategories(categoryList);
        setCities(cityList);
      } catch {
        // Options are optional for browsing; ignore failures here.
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.categoryId) params.set("category_id", filters.categoryId);
    if (filters.cityId) params.set("city_id", filters.cityId);
    params.set("page", String(filters.page));
    params.set("page_size", String(PAGE_SIZE));
    window.history.replaceState(null, "", `/businesses?${params.toString()}`);

    setLoading(true);
    setError("");
    api<BusinessList>(`/api/businesses?${params.toString()}`)
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
    setFilters({ search: "", categoryId: "", cityId: "", page: 1 });
  }

  const hasFilters = Boolean(
    filters.search || filters.categoryId || filters.cityId,
  );
  const selectedCity =
    cities.find((city) => String(city.id) === filters.cityId) ?? null;
  const directoryTitle = selectedCity
    ? `Business Directory in ${selectedCity.name}`
    : "Business Directory";

  useEffect(() => {
    if (filters.cityId && cities.length === 0) return;
    document.title = `${directoryTitle} | ${SITE_NAME}`;
  }, [cities.length, directoryTitle, filters.cityId]);

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
              <li aria-current={selectedCity ? undefined : "page"}>
                {selectedCity ? (
                  <Link
                    href="/businesses"
                    className="transition hover:text-emerald-700"
                  >
                    Business Directory
                  </Link>
                ) : (
                  <span className="font-medium text-slate-700">
                    Business Directory
                  </span>
                )}
              </li>
              {selectedCity ? (
                <Fragment key={`city-${selectedCity.id}`}>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
                  <li aria-current="page" className="font-medium text-slate-700">
                    {selectedCity.name}
                  </li>
                </Fragment>
              ) : null}
            </ol>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {directoryTitle}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {data && !loading
              ? `${data.total} approved listing${data.total === 1 ? "" : "s"} ${selectedCity ? `in ${selectedCity.name}` : "across Philippine cities"}.`
              : "Find approved businesses by name, category, or city."}
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
                placeholder="Search businesses, services, or places"
                aria-label="Search businesses"
              />
            </div>
            <select
              aria-label="Filter by category"
              className={cn(selectClass, "lg:w-52")}
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
              {categories
                .filter((category) => category.parent_id === null)
                .map((parent) => (
                  <optgroup key={parent.id} label={parent.name}>
                    <option value={parent.id}>{parent.name} - all</option>
                    {categories
                      .filter((child) => child.parent_id === parent.id)
                      .map((child) => (
                        <option key={child.id} value={child.id}>
                          {child.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              {categories
                .filter(
                  (category) =>
                    category.parent_id !== null &&
                    !categories.some((item) => item.id === category.parent_id),
                )
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter by city"
              className={cn(selectClass, "lg:w-48")}
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
            <button type="submit" className={buttonClass("primary")}>
              Search
            </button>
          </div>

          {hasFilters ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3">
              <p className="text-xs text-slate-500">
                Filters are active. Results update as you change them.
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

        {!loading ? (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Browse:
            </span>
            {categories
              .filter((category) => category.parent_id === null)
              .slice(0, 12)
              .map((category) => (
                <Link
                  key={category.id}
                  href={`/businesses?category_id=${category.id}`}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  {category.name}
                </Link>
              ))}
          </div>
        ) : null}

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
            : (data?.items ?? []).map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
        </div>

        {!loading && (data?.items.length ?? 0) > 0 ? (
          <div className="mt-8">
            <AdSlot
              slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY}
              minHeight={140}
            />
          </div>
        ) : null}

        {!loading && data && data.items.length === 0 ? (
          <div className="mt-8">
            <EmptyState
              icon={<Store className="h-5 w-5" />}
              title="No businesses match those filters"
              description="Try a different category or city, or reset the filters to see everything."
              action={
                <button
                  type="button"
                  onClick={resetFilters}
                  className={buttonClass("secondary", "sm")}
                >
                  Reset filters
                </button>
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
