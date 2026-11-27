"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, MapPin, Newspaper, Search, Store } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { AdSlot } from "@/components/adsense";
import { BusinessCard } from "@/components/business-card";
import { CityPostCard } from "@/components/city-post-card";
import {
  Alert,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  selectClass,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  Business,
  BusinessList,
  Category,
  City,
  CityPost,
  CityPostList,
} from "@/lib/types";

export default function CityDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [city, setCity] = useState<City | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [posts, setPosts] = useState<CityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);

    async function load() {
      try {
        const detail = await api<City>(
          `/api/cities/slug/${encodeURIComponent(slug)}`,
        );
        const [businessList, postList] = await Promise.all([
          api<BusinessList>(`/api/businesses?city_id=${detail.id}&page_size=6`),
          api<CityPostList>(`/api/city-posts?city_id=${detail.id}&page_size=6`),
        ]);
        if (!active) return;
        setCity(detail);
        setBusinesses(businessList.items);
        setPosts(postList.items);
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

  useEffect(() => {
    let active = true;
    api<Category[]>("/api/categories")
      .then((data) => {
        if (active) setCategories(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <PageLoader label="Loading city…" />;

  if (error || !city) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="City not found"
          description={error || "This city may have been removed."}
          action={
            <Link href="/cities" className={buttonClass("primary", "sm")}>
              Browse cities
            </Link>
          }
        />
      </div>
    );
  }

  const cityLabel = [city.name, city.province].filter(Boolean).join(", ");
  const cityId = city.id;
  const cityName = city.name;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams({ city_id: String(cityId) });
    const query = searchInput.trim();
    if (query) params.set("search", query);
    if (categoryId) params.set("category_id", categoryId);
    router.push(`/businesses?${params.toString()}`);
  }

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <Link
            href="/cities"
            className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            <ArrowLeft className="h-4 w-4" />
            All cities
          </Link>
          <div className="mt-6">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              <MapPin className="h-3.5 w-3.5" />
              {city.region ?? "Philippines"}
            </span>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {cityLabel}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Discover approved businesses, city guides, travel ideas, and
              community stories from {city.name}.
            </p>
          </div>
          <form
            onSubmit={handleSearch}
            className="mt-6 flex max-w-2xl flex-col gap-2 sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                className={cn(inputClass, "pl-9")}
                placeholder={`Search businesses in ${cityName}`}
                aria-label={`Search businesses in ${cityName}`}
              />
            </div>
            <select
              aria-label="Filter by category"
              className={cn(selectClass, "sm:w-52")}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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
            <button
              type="submit"
              className={cn(buttonClass("primary", "sm"), "shrink-0")}
            >
              Search
            </button>
          </form>
          <div className="mt-4 flex flex-wrap gap-3">
            <a href="#businesses" className={buttonClass("primary", "sm")}>
              <Store className="h-4 w-4" />
              Local businesses
            </a>
            <a href="#news" className={buttonClass("secondary", "sm")}>
              <Newspaper className="h-4 w-4" />
              News &amp; events
            </a>
          </div>
        </div>
      </section>

      <section id="businesses" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              Businesses in {city.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {businesses.length} listing{businesses.length === 1 ? "" : "s"}{" "}
              shown
            </p>
          </div>
          <Link
            href={`/businesses?city_id=${city.id}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            View all listings
          </Link>
        </div>

        {businesses.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Store className="h-5 w-5" />}
              title="No listings yet"
              description="There are no approved businesses in this city yet."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-4">
        <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_DIRECTORY} />
      </section>

      <section id="news" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              News &amp; events in {city.name}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {posts.length} story{posts.length === 1 ? "" : "ies"} shown
            </p>
          </div>
          <Link
            href={`/blog?city_id=${city.id}`}
            className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
          >
            View all stories
          </Link>
        </div>

        {posts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={<Newspaper className="h-5 w-5" />}
              title="No stories yet"
              description="There are no published stories for this city yet."
            />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <CityPostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>

      {error ? (
        <section className="mx-auto max-w-6xl px-4 pb-10">
          <Alert>{error}</Alert>
        </section>
      ) : null}
    </div>
  );
}
