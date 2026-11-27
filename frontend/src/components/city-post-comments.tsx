"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  Avatar,
  buttonClass,
  EmptyState,
  Spinner,
  textareaClass,
} from "@/components/ui";
import { hasAnyRole } from "@/lib/roles";
import { formatDate } from "@/lib/utils";
import type { CityPostComment } from "@/lib/types";

export function CityPostComments({ slug }: { slug: string }) {
  const { user, loading: authLoading } = useAuth();
  const [comments, setComments] = useState<CityPostComment[]>([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      setComments(await api<CityPostComment[]>(`/api/city-posts/${slug}/comments`));
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = body.trim();
    if (!message) {
      setError("Please write a comment first.");
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);
    try {
      await api<CityPostComment>(`/api/city-posts/${slug}/comments`, {
        method: "POST",
        body: { body: message },
      });
      setBody("");
      setNotice("Your comment is now live.");
      await loadComments();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: number) {
    if (!window.confirm("Delete this comment?")) return;
    setError("");
    try {
      await api(`/api/city-posts/${slug}/comments/${commentId}`, {
        method: "DELETE",
      });
      await loadComments();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <section id="comments" className="mt-6 space-y-4">
      <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
          {!loading && comments.length > 0 ? (
            <span className="text-xs text-slate-400">
              {comments.length} comment{comments.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {error ? <div className="mt-3"><Alert>{error}</Alert></div> : null}
        {notice ? (
          <div className="mt-3">
            <Alert tone="success">{notice}</Alert>
          </div>
        ) : null}

        {authLoading ? null : user ? (
          <form onSubmit={handleSubmit} className="mt-4">
            <textarea
              className={textareaClass}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Share your thoughts about this post."
              maxLength={2000}
              rows={4}
            />
            <div className="mt-3 flex justify-end">
              <button
                type="submit"
                className={buttonClass("primary", "sm")}
                disabled={submitting}
              >
                {submitting ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                Post comment
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-slate-600">
            <Link
              href={`/login?next=${encodeURIComponent(`/blog/${slug}`)}`}
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Log in
            </Link>{" "}
            or{" "}
            <Link
              href={`/register?next=${encodeURIComponent(`/blog/${slug}`)}`}
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              create an account
            </Link>{" "}
            to join the conversation.
          </p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" />}
          title="No comments yet"
          description="Be the first to share a thought about this post."
        />
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const canDelete =
              Boolean(user) &&
              (comment.user.id === user?.id ||
                hasAnyRole(user, ["admin", "supervisor"]));
            return (
              <li
                key={comment.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={comment.user.full_name} seed={comment.user.id} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {comment.user.full_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(comment.created_at)}
                      </p>
                    </div>
                  </div>
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600">
                  {comment.body}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
