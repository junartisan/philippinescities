"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  inputClass,
  Pagination,
  selectClass,
  SkeletonCard,
  Spinner,
} from "@/components/ui";
import {
  CITY_POST_REVIEW_LABELS,
  CITY_POST_REVIEW_OPTIONS,
  CITY_POST_TYPE_LABELS,
  CITY_POST_TYPE_OPTIONS,
  cityPostReviewTone,
  cityPostTypeTone,
} from "@/lib/blog";
import { formatDate, formatDateTime, plainText } from "@/lib/utils";
import { CityPostEditor } from "./city-post-editor";
import type {
  BlogCategory,
  City,
  CityPost,
  CityPostList,
  CityPostOption,
} from "@/lib/types";

const PAGE_SIZE = 12;

interface Filters {
  search: string;
  cityId: string;
  categoryId: string;
  type: string;
  published: string;
  reviewStatus: string;
}

export default function AdminBlogPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const isAdmin = hasRole(user, "admin");
  const [posts, setPosts] = useState<CityPostList | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [parentOptions, setParentOptions] = useState<CityPostOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CityPost | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    cityId: "",
    categoryId: "",
    type: "",
    published: "",
    reviewStatus: "",
  });
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      api<City[]>("/api/cities"),
      api<BlogCategory[]>("/api/blog-categories"),
      api<CityPostOption[]>("/api/city-posts/parent-options"),
    ])
      .then(([cityData, categoryData, parentData]) => {
        if (!active) return;
        setCities(cityData);
        setCategories(categoryData);
        setParentOptions(parentData);
      })
      .catch(() => {
        if (!active) return;
        setCities([]);
        setCategories([]);
        setParentOptions([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.cityId) params.set("city_id", filters.cityId);
    if (filters.categoryId) {
      params.set("blog_category_id", filters.categoryId);
    }
    if (filters.type) params.set("type", filters.type);
    if (filters.published) params.set("published", filters.published);
    if (filters.reviewStatus) params.set("review_status", filters.reviewStatus);
    params.set("page", String(page));
    params.set("page_size", String(PAGE_SIZE));
    try {
      const data = await api<CityPostList>(
        `/api/admin/city-posts?${params.toString()}`,
      );
      setPosts(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    const editId = Number(searchParams.get("edit"));
    if (!Number.isFinite(editId) || !posts) return;
    const post = posts.items.find((item) => item.id === editId);
    if (post && editing?.id !== post.id) {
      openEdit(post);
    }
  }, [editing?.id, posts, searchParams]);

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

  function handleSaved(saved: CityPost) {
    setEditorOpen(false);
    setEditing(null);
    setNotice(
      saved.is_published
        ? `“${saved.title}” saved and published.`
        : `“${saved.title}” saved as a draft.`,
    );
    loadPosts();
  }

  async function handleReview(post: CityPost, action: "approve" | "reject") {
    const notes =
      action === "reject"
        ? window.prompt("Optional notes for the contributor:", post.review_notes ?? "") ?? ""
        : "";
    setReviewingId(post.id);
    setError("");
    try {
      const updated = await api<CityPost>(
        `/api/admin/city-posts/${post.id}/${action}`,
        {
          method: "POST",
          body: { admin_notes: notes.trim() || null },
        },
      );
      setNotice(
        action === "approve"
          ? `“${updated.title}” approved and published.`
          : `“${updated.title}” sent back to the contributor.`,
      );
      await loadPosts();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDelete(post: CityPost) {
    if (!window.confirm(`Delete “${post.title}”? This cannot be undone.`)) {
      return;
    }
    setDeletingId(post.id);
    setError("");
    try {
      await api(`/api/admin/city-posts/${post.id}`, { method: "DELETE" });
      setNotice(`“${post.title}” deleted.`);
      if (editing?.id === post.id) {
        setEditing(null);
        setEditorOpen(false);
      }
      await loadPosts();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((previous) => ({
      ...previous,
      search: searchInput.trim(),
    }));
    setPage(1);
  }

  function resetFilters() {
    setSearchInput("");
    setFilters({
      search: "",
      cityId: "",
      categoryId: "",
      type: "",
      published: "",
      reviewStatus: "",
    });
    setPage(1);
  }

  const hasFilters = Boolean(
    filters.search ||
      filters.cityId ||
      filters.categoryId ||
      filters.type ||
      filters.published ||
      filters.reviewStatus,
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            WordPress-style publishing
          </p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
            City blog directory
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Publish articles and events for each city. Published posts appear on
            the public city blog and are not tied to business subscriptions.
          </p>
        </div>
        <button type="button" onClick={openNew} className={buttonClass("primary")}>
          <Plus className="h-4 w-4" />
          New post
        </button>
      </div>

      {notice ? (
        <div className="mt-5">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}
      {error ? (
        <div className="mt-5">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      {editorOpen ? (
        <div className="mt-6">
          <CityPostEditor
            key={editing?.id ?? "new"}
            post={editing}
            cities={cities}
            categories={categories}
            parentOptions={parentOptions}
            onSaved={handleSaved}
            onCancel={() => {
              setEditorOpen(false);
              setEditing(null);
            }}
          />
        </div>
      ) : null}

      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search posts by title or body"
              aria-label="Search city blog posts"
            />
          </div>
          <select
            aria-label="Filter by city"
            className={`${selectClass} xl:w-52`}
            value={filters.cityId}
            onChange={(event) => {
              setFilters((previous) => ({
                ...previous,
                cityId: event.target.value,
              }));
              setPage(1);
            }}
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
            className={`${selectClass} xl:w-44`}
            value={filters.categoryId}
            onChange={(event) => {
              setFilters((previous) => ({
                ...previous,
                categoryId: event.target.value,
              }));
              setPage(1);
            }}
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
            className={`${selectClass} xl:w-40`}
            value={filters.type}
            onChange={(event) => {
              setFilters((previous) => ({
                ...previous,
                type: event.target.value,
              }));
              setPage(1);
            }}
          >
            <option value="">All types</option>
            {CITY_POST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by review status"
            className={`${selectClass} xl:w-44`}
            value={filters.reviewStatus}
            onChange={(event) => {
              setFilters((previous) => ({
                ...previous,
                reviewStatus: event.target.value,
              }));
              setPage(1);
            }}
          >
            <option value="">All review states</option>
            {CITY_POST_REVIEW_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by visibility"
            className={`${selectClass} xl:w-36`}
            value={filters.published}
            onChange={(event) => {
              setFilters((previous) => ({
                ...previous,
                published: event.target.value,
              }));
              setPage(1);
            }}
          >
            <option value="">All visibility</option>
            <option value="true">Published</option>
            <option value="false">Hidden</option>
          </select>
          <button type="submit" className={buttonClass("primary")}>
            Search
          </button>
        </div>
        {hasFilters ? (
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
            <p className="text-xs text-slate-500">Filters are active.</p>
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

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : (posts?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="No city blog posts yet"
            description="Create the first article or event and publish it to a city."
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
          posts?.items.map((post) => (
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
                    <Badge tone={post.is_published ? "emerald" : "stone"}>
                      {post.is_published ? "Public" : "Hidden"}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {post.city ? (
                        <>
                          {post.city.name}
                          {post.city.province ? `, ${post.city.province}` : ""}
                        </>
                      ) : (
                        "All Philippines"
                      )}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-slate-900">
                    {post.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                    {post.summary || plainText(post.body)}
                  </p>
                  {post.review_notes ? (
                    <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-xs text-slate-500">
                      Review notes: {post.review_notes}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span>Created {formatDate(post.created_at)}</span>
                    {post.post_type === "event" && post.event_starts_at ? (
                      <span className="inline-flex items-center gap-1 text-violet-700">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateTime(post.event_starts_at)}
                      </span>
                    ) : null}
                    <span>By {post.author?.full_name ?? "Admin"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {post.is_published ? (
                    <Link
                      href={`/blog/${post.slug}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <ExternalLink className="h-4 w-4" />
                      View
                    </Link>
                  ) : null}
                  {post.review_status !== "approved" || !post.is_published ? (
                    <button
                      type="button"
                      onClick={() => handleReview(post, "approve")}
                      className={buttonClass("primary", "sm")}
                      disabled={reviewingId === post.id}
                    >
                      {reviewingId === post.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                  ) : null}
                  {post.review_status !== "rejected" ? (
                    <button
                      type="button"
                      onClick={() => handleReview(post, "reject")}
                      className={buttonClass("ghost", "sm")}
                      disabled={reviewingId === post.id}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openEdit(post)}
                    className={buttonClass("secondary", "sm")}
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                  {isAdmin ? (
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

      <div className="mt-8">
        <Pagination
          page={page}
          pages={posts?.pages ?? 1}
          onChange={(next) => {
            setPage(next);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </div>
    </div>
  );
}
