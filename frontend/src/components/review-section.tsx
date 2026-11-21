"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import type { Business, Review } from "@/lib/types";
import {
  Alert,
  Avatar,
  buttonClass,
  EmptyState,
  RatingInput,
  Spinner,
  Stars,
  textareaClass,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";

export function ReviewSection({ business }: { business: Business }) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Review[]>(
        `/api/businesses/${business.id}/reviews`,
      );
      setReviews(data);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => {
    void loadReviews();
  }, [loadReviews]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    try {
      await api<Review>(`/api/businesses/${business.id}/reviews`, {
        method: "POST",
        body: { rating, comment: comment.trim() || null },
      });
      setRating(0);
      setComment("");
      setNotice("Thanks! Your review is now live.");
      await loadReviews();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(reviewId: number) {
    if (!window.confirm("Delete this review?")) return;
    try {
      await api(`/api/reviews/${reviewId}`, { method: "DELETE" });
      await loadReviews();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const isOwner = Boolean(user && business.owner?.id === user.id);
  const loginHref = `/login?next=${encodeURIComponent(
    `/businesses/${business.slug}`,
  )}`;

  return (
    <section id="reviews" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Reviews</h2>
          <p className="mt-1 text-sm text-slate-500">
            {reviews.length > 0
              ? `${reviews.length} review${reviews.length === 1 ? "" : "s"} from registered users`
              : "No reviews yet."}
          </p>
        </div>
        <Stars rating={business.average_rating} count={business.review_count} />
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {user ? (
        isOwner ? (
          <Alert tone="info">
            You manage this listing, so you cannot review it yourself.
          </Alert>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-slate-900">
              Share your experience
            </h3>
            <div className="mt-3">
              <RatingInput value={rating} onChange={setRating} />
            </div>
            <textarea
              className={`${textareaClass} mt-3`}
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="What was it like doing business here?"
              maxLength={2000}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className={buttonClass("primary", "sm")}
                disabled={submitting}
              >
                {submitting ? <Spinner className="h-4 w-4" /> : null}
                Post review
              </button>
            </div>
          </form>
        )
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
          <Link
            href={loginHref}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            Log in
          </Link>{" "}
          or{" "}
          <Link
            href={`/register?next=${encodeURIComponent(
              `/businesses/${business.slug}`,
            )}`}
            className="font-semibold text-emerald-700 hover:text-emerald-800"
          >
            create an account
          </Link>{" "}
          to leave a review.
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Loading reviews…
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="Be the first to review"
          description="Reviews help other customers decide where to go."
        />
      ) : (
        <ul className="space-y-4">
          {reviews.map((review) => {
            const canDelete =
              Boolean(user) &&
              (review.user.id === user?.id ||
                user?.role === "admin" ||
                user?.role === "supervisor");
            return (
              <li
                key={review.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={review.user.full_name}
                      seed={review.user.id}
                      size="sm"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {review.user.full_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(review.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stars rating={review.rating} />
                    {canDelete ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(review.id)}
                        className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                {review.comment ? (
                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    {review.comment}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
