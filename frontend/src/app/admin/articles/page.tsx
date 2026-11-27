"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CalendarDays,
  ExternalLink,
  Eye,
  EyeOff,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import { CoverImageInput } from "@/components/cover-image-input";
import {
  Alert,
  Badge,
  buttonClass,
  EmptyState,
  Field,
  inputClass,
  Pagination,
  PageLoader,
  selectClass,
  Spinner,
  textareaClass,
} from "@/components/ui";
import {
  ARTICLE_TYPE_LABELS,
  ARTICLE_TYPE_OPTIONS,
  articleTypeTone,
} from "@/lib/articles";
import { cn, formatDate, formatDateTime } from "@/lib/utils";
import type {
  Article,
  ArticleList,
  ArticleType,
  Business,
  BusinessList,
} from "@/lib/types";

interface Filters {
  search: string;
  type: string;
  published: string;
}

interface ArticleFormState {
  business_id: string;
  title: string;
  summary: string;
  body: string;
  cover_image_url: string;
  article_type: ArticleType;
  event_starts_at: string;
  event_ends_at: string;
  is_published: boolean;
}

const EMPTY_FORM: ArticleFormState = {
  business_id: "",
  title: "",
  summary: "",
  body: "",
  cover_image_url: "",
  article_type: "product_update",
  event_starts_at: "",
  event_ends_at: "",
  is_published: true,
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export default function AdminArticlesPage() {
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const [data, setData] = useState<ArticleList | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    type: "",
    published: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.search) params.set("search", filters.search);
      if (filters.type) params.set("type", filters.type);
      if (filters.published) params.set("published", filters.published);
      params.set("page", String(page));
      params.set("page_size", "12");
      const result = await api<ArticleList>(
        `/api/admin/articles?${params.toString()}`,
      );
      setData(result);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  useEffect(() => {
    let active = true;
    api<BusinessList>("/api/admin/businesses?status=all&page=1&page_size=100")
      .then((result) => {
        if (active) setBusinesses(result.items);
      })
      .catch(() => {
        if (active) setBusinesses([]);
      });
    return () => {
      active = false;
    };
  }, []);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFilters((previous) => ({ ...previous, search: searchInput.trim() }));
    setPage(1);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditing(null);
  }

  function openCreate() {
    resetForm();
    setNotice("");
    setEditorOpen(true);
  }

  function openEdit(article: Article) {
    setEditing(article);
    setNotice("");
    setForm({
      business_id: String(article.business_id),
      title: article.title,
      summary: article.summary ?? "",
      body: article.body,
      cover_image_url: article.cover_image_url ?? "",
      article_type: article.article_type,
      event_starts_at: toLocalInput(article.event_starts_at),
      event_ends_at: toLocalInput(article.event_ends_at),
      is_published: article.is_published,
    });
    setEditorOpen(true);
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.business_id) {
      setError("Choose a business for this article.");
      return;
    }
    if (form.article_type === "event" && !form.event_starts_at) {
      setError("Event articles need a start date and time.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim() || null,
        body: form.body.trim(),
        cover_image_url: form.cover_image_url.trim() || null,
        article_type: form.article_type,
        event_starts_at:
          form.article_type === "event" ? toIso(form.event_starts_at) : null,
        event_ends_at:
          form.article_type === "event" ? toIso(form.event_ends_at) : null,
        is_published: form.is_published,
      };
      if (editing) {
        await api<Article>(`/api/articles/${editing.id}`, {
          method: "PATCH",
          body: { ...payload, is_published: form.is_published },
        });
        setNotice("Article updated.");
      } else {
        await api<Article>(`/api/businesses/${form.business_id}/articles`, {
          method: "POST",
          body: payload,
        });
        setNotice("Article created.");
      }
      setEditorOpen(false);
      resetForm();
      await loadArticles();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(article: Article) {
    setBusyId(article.id);
    setNotice("");
    try {
      await api<Article>(`/api/articles/${article.id}`, {
        method: "PATCH",
        body: { is_published: !article.is_published },
      });
      setNotice(
        article.is_published ? "Article unpublished." : "Article published.",
      );
      await loadArticles();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function removeArticle(article: Article) {
    if (!window.confirm(`Delete "${article.title}"? This cannot be undone.`)) {
      return;
    }
    setBusyId(article.id);
    setNotice("");
    try {
      await api(`/api/articles/${article.id}`, { method: "DELETE" });
      if (editing?.id === article.id) {
        resetForm();
        setEditorOpen(false);
      }
      setNotice("Article deleted.");
      await loadArticles();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const hasFilters = Boolean(filters.search || filters.type || filters.published);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Business articles
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Review and manage updates published by business owners. Editors can
            add, edit, publish, unpublish, and remove articles.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className={buttonClass("primary")}
        >
          <Plus className="h-4 w-4" />
          New article
        </button>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {editorOpen ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              {editing ? "Edit article" : "New article"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setEditorOpen(false);
                resetForm();
              }}
              className={buttonClass("ghost", "sm")}
            >
              <X className="h-4 w-4" />
              Close
            </button>
          </div>

          <form onSubmit={saveArticle} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Business" htmlFor="admin-article-business">
                <select
                  id="admin-article-business"
                  className={selectClass}
                  value={form.business_id}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      business_id: event.target.value,
                    }))
                  }
                  disabled={Boolean(editing)}
                  required
                >
                  <option value="">Choose a business</option>
                  {businesses.map((business) => (
                    <option key={business.id} value={business.id}>
                      {business.name}
                      {business.city ? `, ${business.city.name}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Article type" htmlFor="admin-article-type">
                <select
                  id="admin-article-type"
                  className={selectClass}
                  value={form.article_type}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      article_type: event.target.value as ArticleType,
                    }))
                  }
                >
                  {ARTICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Title" htmlFor="admin-article-title">
              <input
                id="admin-article-title"
                className={inputClass}
                value={form.title}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    title: event.target.value,
                  }))
                }
                maxLength={200}
                required
                minLength={3}
              />
            </Field>
            <Field label="Summary" htmlFor="admin-article-summary">
              <input
                id="admin-article-summary"
                className={inputClass}
                value={form.summary}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    summary: event.target.value,
                  }))
                }
                placeholder="Optional short summary"
                maxLength={500}
              />
            </Field>
            <Field label="Article body" htmlFor="admin-article-body">
              <textarea
                id="admin-article-body"
                className={cn(textareaClass, "min-h-[180px]")}
                value={form.body}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    body: event.target.value,
                  }))
                }
                maxLength={20000}
                required
                minLength={10}
              />
            </Field>
            <CoverImageInput
              value={form.cover_image_url || null}
              onChange={(value) =>
                setForm((previous) => ({
                  ...previous,
                  cover_image_url: value ?? "",
                }))
              }
            />

            {form.article_type === "event" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event starts" htmlFor="admin-article-starts">
                  <input
                    id="admin-article-starts"
                    type="datetime-local"
                    className={inputClass}
                    value={form.event_starts_at}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        event_starts_at: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>
                <Field label="Event ends" htmlFor="admin-article-ends">
                  <input
                    id="admin-article-ends"
                    type="datetime-local"
                    className={inputClass}
                    value={form.event_ends_at}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        event_ends_at: event.target.value,
                      }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    is_published: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-stone-300 text-emerald-600"
              />
              Published
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className={buttonClass("primary", "sm")}
              >
                {saving ? <Spinner className="h-3.5 w-3.5" /> : null}
                {editing ? "Save article" : "Create article"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorOpen(false);
                  resetForm();
                }}
                className={buttonClass("ghost", "sm")}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            className={cn(inputClass, "pl-9")}
            placeholder="Search articles by title, body, or business"
          />
        </div>
        <select
          aria-label="Filter by article type"
          className={cn(selectClass, "w-44")}
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
          {ARTICLE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by publication status"
          className={cn(selectClass, "w-40")}
          value={filters.published}
          onChange={(event) => {
            setFilters((previous) => ({
              ...previous,
              published: event.target.value,
            }));
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          <option value="true">Published</option>
          <option value="false">Unpublished</option>
        </select>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              setFilters({ search: "", type: "", published: "" });
              setPage(1);
            }}
            className={buttonClass("ghost")}
          >
            Reset
          </button>
        ) : null}
      </form>

      {loading ? (
        <PageLoader label="Loading business articles…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Newspaper className="h-5 w-5" />}
          title="No articles found"
          description="Try another search or create the first article."
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((article) => (
            <li
              key={article.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/articles/${article.slug}`}
                      className="text-base font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {article.title}
                    </Link>
                    <Badge tone={articleTypeTone(article.article_type)}>
                      {ARTICLE_TYPE_LABELS[article.article_type]}
                    </Badge>
                    <Badge tone={article.is_published ? "emerald" : "stone"}>
                      {article.is_published ? "Published" : "Unpublished"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    <Link
                      href={`/businesses/${article.business.slug}`}
                      className="font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      {article.business.name}
                    </Link>{" "}
                    · {article.business.city.name} ·{" "}
                    {article.author?.full_name ?? "Unknown author"} ·{" "}
                    {formatDate(article.published_at)}
                  </p>
                  {article.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      {article.summary}
                    </p>
                  ) : null}
                  {article.article_type === "event" &&
                  article.event_starts_at ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-violet-700">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {formatDateTime(article.event_starts_at)}
                      {article.event_ends_at
                        ? ` – ${formatDateTime(article.event_ends_at)}`
                        : ""}
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Link
                    href={`/articles/${article.slug}`}
                    className={buttonClass("ghost", "sm")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View
                  </Link>
                  <button
                    type="button"
                    onClick={() => togglePublished(article)}
                    disabled={busyId === article.id}
                    className={buttonClass("secondary", "sm")}
                  >
                    {busyId === article.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : article.is_published ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                    {article.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(article)}
                    className={buttonClass("secondary", "sm")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => removeArticle(article)}
                      disabled={busyId === article.id}
                      className={buttonClass(
                        "secondary",
                        "sm",
                        "text-rose-600 hover:border-rose-200 hover:text-rose-700",
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        pages={data?.pages ?? 1}
        onChange={(nextPage) => setPage(nextPage)}
      />
    </div>
  );
}
