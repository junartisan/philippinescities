"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { ExternalLink, MessageSquare, Search, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  Avatar,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  Stars,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import type { AdminReview } from "@/lib/types";

export default function AdminReviewsPage() {
  const { user } = useAuth();
  const canDelete =
    user?.role === "admin" || user?.role === "supervisor";
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (appliedSearch) params.set("search", appliedSearch);
      const query = params.toString();
      const data = await api<AdminReview[]>(
        `/api/admin/reviews${query ? `?${query}` : ""}`,
      );
      setReviews(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
  }

  async function removeReview(review: AdminReview) {
    if (
      !window.confirm(
        `Remove ${review.user.full_name}'s review of ${review.business.name}?`,
      )
    ) {
      return;
    }
    setBusyId(review.id);
    setNotice("");
    try {
      await api(`/api/reviews/${review.id}`, { method: "DELETE" });
      setNotice("Review removed.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Review moderation
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Reviews are published immediately. Remove reviews that violate
          community guidelines or contain abusive content.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(inputClass, "pl-9")}
            placeholder="Search by business, reviewer, or comment"
          />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <PageLoader label="Loading reviews…" />
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No reviews found"
          description="Try another search, or wait for new reviews to come in."
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar
                    name={review.user.full_name}
                    seed={review.user.id}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {review.user.full_name}
                      </p>
                      <Stars rating={review.rating} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDate(review.created_at)} ·{" "}
                      <Link
                        href={`/businesses/${review.business.slug}`}
                        className="font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        {review.business.name}
                      </Link>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/businesses/${review.business.slug}#reviews`}
                    className={buttonClass("ghost", "sm")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    View listing
                  </Link>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => removeReview(review)}
                      className={buttonClass("secondary", "sm")}
                      disabled={busyId === review.id}
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
              {review.comment ? (
                <p className="mt-3 border-t border-stone-100 pt-3 text-sm leading-6 text-slate-600">
                  {review.comment}
                </p>
              ) : (
                <p className="mt-3 border-t border-stone-100 pt-3 text-sm italic text-slate-400">
                  No written comment.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
