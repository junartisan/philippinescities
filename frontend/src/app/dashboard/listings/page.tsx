"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Newspaper, Pencil, Plus, Sparkles, Store, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Badge,
  BusinessLogo,
  buttonClass,
  EmptyState,
  PageLoader,
  StatusBadge,
  Stars,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Business } from "@/lib/types";

export default function MyListingsPage() {
  const [listings, setListings] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Business[]>("/api/businesses/mine");
      setListings(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(business: Business) {
    if (
      !window.confirm(
        `Delete "${business.name}"? This also removes its reviews and claims.`,
      )
    ) {
      return;
    }
    setDeletingId(business.id);
    try {
      await api(`/api/businesses/${business.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <PageLoader label="Loading your listings…" />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">My listings</h2>
          <p className="mt-1 text-sm text-slate-500">
            New and edited listings are reviewed by an admin before they appear
            in the public directory.
          </p>
        </div>
        <Link
          href="/dashboard/listings/new"
          className={buttonClass("secondary", "sm")}
        >
          <Plus className="h-4 w-4" />
          Add listing
        </Link>
      </div>

      {error ? <Alert>{error}</Alert> : null}

      {listings.length === 0 ? (
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="No listings yet"
          description="Add your business to the directory, or claim an existing listing from its page."
          action={
            <Link
              href="/dashboard/listings/new"
              className={buttonClass("primary", "sm")}
            >
              <Plus className="h-4 w-4" />
              Add your first listing
            </Link>
          }
        />
      ) : (
        <ul className="space-y-4">
          {listings.map((business) => (
            <li
              key={business.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-4">
                  <BusinessLogo
                    name={business.name}
                    seed={business.id}
                    logoUrl={business.logo_url}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900">
                        {business.name}
                      </h3>
                      <StatusBadge status={business.status} />
                      {business.is_featured ? (
                        <Badge tone="amber">Featured</Badge>
                      ) : null}
                      {business.is_paid ? (
                        <Badge tone="emerald">Paid access</Badge>
                      ) : business.article_access_override === "rejected" ? (
                        <Badge tone="rose">Subscription off</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {business.category.name} · {business.city.name}
                      {business.city.province
                        ? `, ${business.city.province}`
                        : ""}
                    </p>
                    <div className="mt-2">
                      <Stars
                        rating={business.average_rating}
                        count={business.review_count}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-400">
                      Updated {formatDate(business.updated_at)}
                    </p>
                    {business.status === "rejected" && business.rejection_reason ? (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Admin note: {business.rejection_reason}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {business.status === "approved" ? (
                    <Link
                      href={`/dashboard/listings/${business.id}/articles`}
                      className={buttonClass("secondary", "sm")}
                    >
                      <Newspaper className="h-3.5 w-3.5" />
                      {business.is_paid ? "Articles" : "Unlock articles"}
                    </Link>
                  ) : null}
                  {business.status === "approved" ? (
                    <Link
                      href={`/dashboard/listings/${business.id}/featured`}
                      className={buttonClass("secondary", "sm")}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      {business.is_featured ? "Featured" : "Feature listing"}
                    </Link>
                  ) : null}
                  {business.status === "approved" ? (
                    <Link
                      href={`/businesses/${business.slug}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      View
                    </Link>
                  ) : null}
                  <Link
                    href={`/dashboard/listings/${business.id}/edit`}
                    className={buttonClass("secondary", "sm")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(business)}
                    disabled={deletingId === business.id}
                    className={buttonClass("ghost", "sm", "text-rose-600 hover:bg-rose-50")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
