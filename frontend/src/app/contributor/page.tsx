"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  MapPin,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { RequireAuth } from "@/components/guards";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  Field,
  PageLoader,
  Spinner,
  textareaClass,
} from "@/components/ui";
import {
  CITY_POST_REVIEW_LABELS,
  CITY_POST_TYPE_LABELS,
  cityPostReviewTone,
  cityPostTypeTone,
  contributorStatusTone,
} from "@/lib/blog";
import { formatDate, formatDateTime, plainText } from "@/lib/utils";
import { ContributorPostEditor } from "./contributor-post-editor";
import type {
  BlogCategory,
  City,
  CityPost,
  CityPostList,
  ContributorStatus,
} from "@/lib/types";

function ContributorContent() {
  const [status, setStatus] = useState<ContributorStatus | null>(null);
  const [posts, setPosts] = useState<CityPostList | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [message, setMessage] = useState("");
  const [selectedCityIds, setSelectedCityIds] = useState<number[]>([]);
  const [applying, setApplying] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CityPost | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      api<ContributorStatus>("/api/contributor/status"),
      api<City[]>("/api/cities"),
      api<BlogCategory[]>("/api/blog-categories"),
    ])
      .then(([statusData, cityData, categoryData]) => {
        if (!active) return;
        setStatus(statusData);
        setSelectedCityIds(statusData.cities.map((city) => city.id));
        setCities(cityData);
        setCategories(categoryData);
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

  const loadPosts = useCallback(async () => {
    try {
      const data = await api<CityPostList>("/api/contributor/posts");
      setPosts(data);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    if (status?.status === "approved") {
      void loadPosts();
    }
  }, [status?.status, loadPosts]);

  function toggleCity(cityId: number) {
    setSelectedCityIds((previous) =>
      previous.includes(cityId)
        ? previous.filter((id) => id !== cityId)
        : [...previous, cityId],
    );
  }

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedCityIds.length === 0) {
      setError("Select at least one city you want to write for.");
      return;
    }
    setApplying(true);
    setError("");
    setNotice("");
    try {
      const updated = await api<ContributorStatus>("/api/contributor/apply", {
        method: "POST",
        body: {
          message: message.trim() || null,
          city_ids: selectedCityIds,
        },
      });
      setStatus(updated);
      setSelectedCityIds(updated.cities.map((city) => city.id));
      setMessage("");
      setNotice("Contributor application submitted for admin review.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  function openNew() {
    setEditing(null);
    setEditorOpen(true);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(post: CityPost) {
    setEditing(post);
    setEditorOpen(true);
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSaved(saved: CityPost, submitted: boolean) {
    setEditorOpen(false);
    setEditing(null);
    setNotice(
      submitted
        ? `“${saved.title}” submitted for admin review.`
        : `“${saved.title}” saved as a draft.`,
    );
    void loadPosts();
  }

  async function handleDelete(post: CityPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      return;
    }
    setDeletingId(post.id);
    setError("");
    try {
      await api(`/api/contributor/posts/${post.id}`, { method: "DELETE" });
      setNotice(`“${post.title}” deleted.`);
      await loadPosts();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <PageLoader label="Loading contributor access…" />;

  const isApproved = status?.status === "approved";
  const allowedCities = status?.cities ?? [];
  const pendingCount =
    posts?.items.filter((post) => post.review_status === "pending").length ?? 0;
  const approvedCount =
    posts?.items.filter((post) => post.review_status === "approved").length ?? 0;
  const rejectedCount =
    posts?.items.filter((post) => post.review_status === "rejected").length ?? 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {error ? <Alert>{error}</Alert> : null}
      {notice ? (
        <div className="mt-4">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      {!isApproved ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 lg:col-span-2">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <UserCheck className="h-4 w-4" />
              Write for Philippines Cities
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Become a city blog contributor
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Approved contributors can write city articles and events. An
              admin reviews both contributor applications and every submitted
              post before it appears publicly.
            </p>

            {status?.status === "pending" ? (
              <div className="mt-6 space-y-4">
                <Alert tone="info">
                  Your contributor application is pending admin review.
                </Alert>
                {status.cities.length ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Requested cities
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {status.cities.map((city) => (
                        <Badge key={city.id} tone="emerald">
                          <MapPin className="h-3 w-3" />
                          {city.name}
                          {city.province ? `, ${city.province}` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}
                {status.message ? (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-slate-600">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Your application
                    </p>
                    <p className="mt-1">{status.message}</p>
                  </div>
                ) : null}
                {status.admin_notes ? (
                  <p className="text-sm text-slate-500">
                    Admin notes: {status.admin_notes}
                  </p>
                ) : null}
              </div>
            ) : (
              <form onSubmit={apply} className="mt-6 space-y-4">
                {status?.status === "rejected" ? (
                  <Alert tone="warning">
                    Your previous application was rejected.
                    {status.admin_notes
                      ? ` Admin notes: ${status.admin_notes}`
                      : " You can apply again below."}
                  </Alert>
                ) : null}
                <Field
                  label="Cities you want to write for"
                  hint="Select at least one city. An admin can add or remove approved cities later."
                >
                  <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-3 sm:grid-cols-2">
                    {cities.map((city) => (
                      <label
                        key={city.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-white"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCityIds.includes(city.id)}
                          onChange={() => toggleCity(city.id)}
                          className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>
                          {city.name}
                          {city.province ? `, ${city.province}` : ""}
                        </span>
                      </label>
                    ))}
                  </div>
                </Field>
                <Field
                  label="Why do you want to write for the city blog?"
                  htmlFor="contributor-message"
                  hint="Share your writing background, local knowledge, or story ideas."
                >
                  <textarea
                    id="contributor-message"
                    className={textareaClass}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Tell the admin about the city stories you want to write..."
                    maxLength={2000}
                  />
                </Field>
                <button
                  type="submit"
                  className={buttonClass("primary", "sm")}
                  disabled={applying}
                >
                  {applying ? (
                    <Spinner className="h-4 w-4" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Apply to become a contributor
                </button>
              </form>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                How it works
              </h2>
              <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    1
                  </span>
                  Apply and tell an admin what you want to write.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    2
                  </span>
                  Once approved, submit city articles or events.
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
                    3
                  </span>
                  An admin reviews each post before it is published.
                </li>
              </ol>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Current status
              </h2>
              <div className="mt-3">
                <Badge tone={contributorStatusTone(status?.status ?? null)}>
                  {status?.status
                    ? status.status === "pending"
                      ? "Pending review"
                      : status.status === "rejected"
                        ? "Application rejected"
                        : "Approved contributor"
                    : "Not applied"}
                </Badge>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Admin approval is required before you can create posts. Every
                post is also reviewed separately.
              </p>
            </div>
          </aside>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Contributor dashboard
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
                City blog submissions
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Write city articles and events, save drafts, and submit them for
                admin approval.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-medium text-slate-400">
                  Approved cities:
                </span>
                {allowedCities.length ? (
                  allowedCities.map((city) => (
                    <Badge key={city.id} tone="emerald">
                      <MapPin className="h-3 w-3" />
                      {city.name}
                      {city.province ? `, ${city.province}` : ""}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-rose-600">
                    No cities assigned
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={openNew}
              className={buttonClass("primary")}
              disabled={allowedCities.length === 0}
            >
              <Plus className="h-4 w-4" />
              New post
            </button>
          </div>

          {allowedCities.length === 0 ? (
            <div className="mt-5">
              <Alert tone="warning">
                An admin has not assigned any cities to your contributor account
                yet. Contact an admin before creating a post.
              </Alert>
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <Clock3 className="h-3.5 w-3.5" />
                Pending review
              </span>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {pendingCount}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approved
              </span>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {approvedCount}
              </p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
                <XCircle className="h-3.5 w-3.5" />
                Rejected
              </span>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {rejectedCount}
              </p>
            </div>
          </div>

          {editorOpen ? (
            <div className="mt-6">
              <ContributorPostEditor
                key={editing?.id ?? "new"}
                post={editing}
                cities={allowedCities}
                categories={categories}
                onSaved={handleSaved}
                onCancel={() => {
                  setEditorOpen(false);
                  setEditing(null);
                }}
              />
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {!posts ? (
              <PageLoader label="Loading your posts…" />
            ) : posts.items.length === 0 ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No posts yet"
                description="Write your first city article or event and submit it for admin review."
                action={
                  <button
                    type="button"
                    onClick={openNew}
                    className={buttonClass("primary", "sm")}
                  >
                    <Plus className="h-4 w-4" />
                    New post
                  </button>
                }
              />
            ) : (
              posts.items.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={cityPostTypeTone(post.post_type)}>
                          {CITY_POST_TYPE_LABELS[post.post_type]}
                        </Badge>
                        {post.blog_category ? (
                          <Badge tone="sky">{post.blog_category.name}</Badge>
                        ) : null}
                        <Badge tone={cityPostReviewTone(post.review_status)}>
                          {CITY_POST_REVIEW_LABELS[post.review_status]}
                        </Badge>
                        <span className="text-xs text-slate-400">
                          {post.city.name}
                          {post.city.province ? `, ${post.city.province}` : ""}
                        </span>
                      </div>
                      <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                        {post.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                        {post.summary || plainText(post.body)}
                      </p>
                      {post.review_notes ? (
                        <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                          Admin notes: {post.review_notes}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                        <span>Updated {formatDate(post.updated_at)}</span>
                        {post.post_type === "event" && post.event_starts_at ? (
                          <span className="inline-flex items-center gap-1 text-violet-700">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatDateTime(post.event_starts_at)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {post.review_status === "approved" && post.is_published ? (
                        <Link
                          href={`/blog/${post.slug}`}
                          className={buttonClass("ghost", "sm")}
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEdit(post)}
                          className={buttonClass("secondary", "sm")}
                        >
                          <Pencil className="h-4 w-4" />
                          {post.review_status === "rejected"
                            ? "Edit & resubmit"
                            : "Edit"}
                        </button>
                      )}
                      {post.review_status !== "approved" ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(post)}
                          className={buttonClass("danger", "sm")}
                          disabled={deletingId === post.id}
                        >
                          {deletingId === post.id ? (
                            <Spinner className="h-4 w-4" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ContributorPage() {
  return (
    <RequireAuth>
      <ContributorContent />
    </RequireAuth>
  );
}
