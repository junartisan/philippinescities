"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  EmptyState,
  inputClass,
  PageLoader,
} from "@/components/ui";
import type { City } from "@/lib/types";

export default function CitiesPage() {
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;
    api<City[]>("/api/cities")
      .then((data) => {
        if (active) setCities(data);
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

  const groups = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = term
      ? cities.filter((city) =>
          [city.name, city.province ?? "", city.region ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(term),
        )
      : cities;
    const map = new Map<string, City[]>();
    for (const city of filtered) {
      const region = city.region ?? "Other regions";
      const list = map.get(region) ?? [];
      list.push(city);
      map.set(region, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [cities, query]);

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Cities
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Browse businesses by the city they call home. Listings are grouped by
            region so you can plan around where you are.
          </p>
          <div className="relative mt-6 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search a city, province, or region"
              aria-label="Search cities"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10">
        {error ? (
          <div className="mb-6">
            <Alert>{error}</Alert>
          </div>
        ) : null}

        {loading ? (
          <PageLoader label="Loading cities…" />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<MapPin className="h-5 w-5" />}
            title="No cities found"
            description={
              query
                ? "Try a different search term."
                : "An admin needs to add cities before listings can be created."
            }
          />
        ) : (
          <div className="space-y-8">
            {groups.map(([region, regionCities]) => (
              <div
                key={region}
                className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900">
                    {region}
                  </h2>
                  <span className="text-xs text-slate-400">
                    {regionCities.length} cit
                    {regionCities.length === 1 ? "y" : "ies"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {regionCities.map((city) => (
                    <div
                      key={city.id}
                      className="group rounded-xl border border-stone-200 transition hover:border-emerald-200 hover:bg-emerald-50/50"
                    >
                      <Link
                        href={`/cities/${city.slug}`}
                        className="block px-4 pt-2.5"
                      >
                        <span className="block text-sm font-medium text-slate-700 group-hover:text-emerald-700">
                          {city.name}
                        </span>
                        {city.province ? (
                          <span className="block text-xs text-slate-400">
                            {city.province}
                          </span>
                        ) : null}
                      </Link>
                      <Link
                        href={`/cities/${city.slug}#news`}
                        className="block px-4 pb-2.5 pt-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        News &amp; events
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
