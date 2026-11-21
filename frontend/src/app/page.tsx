"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  Store,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { CategoryIcon } from "@/components/category-icon";
import { BusinessCard } from "@/components/business-card";
import {
  accentFor,
  Alert,
  buttonClass,
  SkeletonCard,
} from "@/components/ui";
import type { Business, BusinessList, Category, City } from "@/lib/types";

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [featured, setFeatured] = useState<Business[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [categoryList, cityList, businessList] = await Promise.all([
          api<Category[]>("/api/categories"),
          api<City[]>("/api/cities"),
          api<BusinessList>("/api/businesses?page=1&page_size=6"),
        ]);
        if (!active) return;
        setCategories(categoryList);
        setCities(cityList);
        setFeatured(businessList.items);
        setTotal(businessList.total);
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
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `/businesses?search=${encodeURIComponent(term)}` : "/businesses");
  }

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 text-white">
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:py-24">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-emerald-50">
            <MapPin className="h-3.5 w-3.5" />
            The Philippine business directory
          </span>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
            Find local businesses that make the Philippines feel like home.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-emerald-100/90 sm:text-lg">
            Browse restaurants, hotels, shops, and services by category and city.
            Business owners can claim their listing, keep it current, and hear
            directly from customers.
          </p>

          <form
            onSubmit={handleSearch}
            className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-lg sm:flex-row"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border-0 bg-transparent py-3 pl-10 pr-3 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                placeholder="Search businesses, services, or places"
                aria-label="Search businesses"
              />
            </div>
            <button type="submit" className={buttonClass("primary")}>
              Search
            </button>
          </form>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-emerald-100/80">
            <span className="inline-flex items-center gap-2">
              <Store className="h-4 w-4" />
              {loading ? "—" : total} listings
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {loading ? "—" : categories.length} categories
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              {loading ? "—" : cities.length} cities
            </span>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Browse by category
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Start with what you need, then narrow it down by city.
            </p>
          </div>
          <Link
            href="/categories"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            All categories
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {loading
            ? Array.from({ length: 8 }).map((_, index) => (
                <div
                  key={index}
                  className="h-24 animate-pulse rounded-2xl border border-stone-200 bg-white"
                />
              ))
            : categories.slice(0, 8).map((category) => {
                const accent = accentFor(category.id);
                return (
                  <Link
                    key={category.id}
                    href={`/businesses?category_id=${category.id}`}
                    className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent.tile}`}
                    >
                      <CategoryIcon slug={category.slug} className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                        {category.name}
                      </span>
                      <span className="mt-0.5 line-clamp-1 block text-xs text-slate-500">
                        {category.description ?? "Explore local listings"}
                      </span>
                    </span>
                  </Link>
                );
              })}
        </div>
      </section>

      <section className="border-y border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                Featured listings
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                A few of the businesses in the directory right now.
              </p>
            </div>
            <Link
              href="/businesses"
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
            >
              See all businesses
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {error ? (
            <div className="mt-6">
              <Alert>{error}</Alert>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <SkeletonCard key={index} />
                ))
              : featured.map((business) => (
                  <BusinessCard key={business.id} business={business} />
                ))}
          </div>

          {!loading && featured.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-6 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">
                No approved listings yet.
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Be the first to add a business to the directory.
              </p>
              <Link
                href="/dashboard/listings/new"
                className={buttonClass("primary", "sm", "mt-4")}
              >
                Add a listing
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Explore by city
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Supporting local starts with knowing what is nearby.
            </p>
          </div>
          <Link
            href="/cities"
            className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            View all cities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap gap-2">
          {loading
            ? Array.from({ length: 10 }).map((_, index) => (
                <div
                  key={index}
                  className="h-9 w-28 animate-pulse rounded-full bg-stone-200"
                />
              ))
            : cities.slice(0, 12).map((city) => (
                <Link
                  key={city.id}
                  href={`/businesses?city_id=${city.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  {city.name}
                </Link>
              ))}
        </div>
      </section>

      <section className="border-t border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            How Philippines Cities works
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: <Search className="h-5 w-5" />,
                title: "Search the directory",
                body: "Filter by category and city to find the businesses you need, wherever you are in the Philippines.",
              },
              {
                icon: <ShieldCheck className="h-5 w-5" />,
                title: "Claim your listing",
                body: "Business owners request access to an existing listing. An admin verifies every claim before ownership is transferred.",
              },
              {
                icon: <Star className="h-5 w-5" />,
                title: "Build trust with reviews",
                body: "Registered users can leave one review per business, helping the whole community make better choices.",
              },
            ].map((step, index) => (
              <div
                key={step.title}
                className="rounded-2xl border border-stone-200 bg-stone-50 p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    {step.icon}
                  </span>
                  <span className="text-xs font-semibold text-stone-400">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-700 px-6 py-12 text-white sm:px-12">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-300/10 blur-2xl" />
          <div className="relative max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Own a business? Make sure customers can find you.
            </h2>
            <p className="mt-3 text-sm leading-6 text-emerald-100/90 sm:text-base">
              Add your listing or claim an existing one. Keep your contact
              details, hours, and story up to date — all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={user ? "/dashboard/listings/new" : "/register"}
                className={buttonClass(
                  "primary",
                  "md",
                  "bg-white text-emerald-800 hover:bg-emerald-50",
                )}
              >
                {user ? "Add a listing" : "Create a free account"}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={user ? "/dashboard" : "/businesses"}
                className={buttonClass(
                  "secondary",
                  "md",
                  "border-white/30 bg-transparent text-white hover:border-white hover:bg-white/10 hover:text-white",
                )}
              >
                {user ? "Go to dashboard" : "Browse the directory"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
