"use client";

import { useState, type FormEvent } from "react";
import { Save, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  buttonClass,
  Field,
  inputClass,
  selectClass,
  Spinner,
  textareaClass,
} from "@/components/ui";
import { CITY_POST_TYPE_OPTIONS } from "@/lib/blog";
import { CoverImageInput } from "@/components/cover-image-input";
import { RichTextEditor } from "@/components/rich-text-editor";
import type {
  BlogCategory,
  City,
  CityPost,
  CityPostPayload,
  CityPostType,
} from "@/lib/types";

interface FormState {
  city_id: string;
  blog_category_id: string;
  title: string;
  summary: string;
  body: string;
  cover_image_url: string;
  post_type: CityPostType;
  event_starts_at: string;
  event_ends_at: string;
  is_published: boolean;
}

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

function initialForm(post: CityPost | null): FormState {
  return {
    city_id: post?.city_id ? String(post.city_id) : "",
    blog_category_id: String(post?.blog_category_id ?? ""),
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    body: post?.body ?? "",
    cover_image_url: post?.cover_image_url ?? "",
    post_type: post?.post_type ?? "article",
    event_starts_at: toLocalInput(post?.event_starts_at ?? null),
    event_ends_at: toLocalInput(post?.event_ends_at ?? null),
    is_published: post?.is_published ?? true,
  };
}

export function CityPostEditor({
  post,
  cities,
  categories,
  onSaved,
  onCancel,
}: {
  post: CityPost | null;
  cities: City[];
  categories: BlogCategory[];
  onSaved: (post: CityPost) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(post));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const canPublish = !post || post.review_status === "approved";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (form.post_type === "event" && !form.event_starts_at) {
      setError("Events need a start date and time.");
      return;
    }
    setSaving(true);
    setError("");
    const payload: CityPostPayload = {
      city_id: form.city_id ? Number(form.city_id) : null,
      blog_category_id: form.blog_category_id
        ? Number(form.blog_category_id)
        : null,
      title: form.title.trim(),
      summary: form.summary.trim() || null,
      body: form.body.trim(),
      cover_image_url: form.cover_image_url.trim() || null,
      post_type: form.post_type,
      event_starts_at:
        form.post_type === "event" ? toIso(form.event_starts_at) : null,
      event_ends_at:
        form.post_type === "event" ? toIso(form.event_ends_at) : null,
      is_published: canPublish ? form.is_published : false,
    };
    try {
      const saved = post
        ? await api<CityPost>(`/api/admin/city-posts/${post.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await api<CityPost>("/api/admin/city-posts", {
            method: "POST",
            body: payload,
          });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            {post ? "Edit post" : "New post"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {post ? post.title : "Write for a city"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("ghost", "sm")}
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>

      {error ? (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field
          label="City"
          htmlFor="city-post-city"
          hint="Leave as All Philippines for a general article."
        >
          <select
            id="city-post-city"
            className={selectClass}
            value={form.city_id}
            onChange={(event) => update("city_id", event.target.value)}
          >
            <option value="">All Philippines</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
                {city.province ? `, ${city.province}` : ""}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Post type" htmlFor="city-post-type">
          <select
            id="city-post-type"
            className={selectClass}
            value={form.post_type}
            onChange={(event) =>
              update("post_type", event.target.value as CityPostType)
            }
          >
            {CITY_POST_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Blog category"
          htmlFor="city-post-category"
          hint="Optional. Helps readers browse related city stories."
        >
          <select
            id="city-post-category"
            className={selectClass}
            value={form.blog_category_id}
            onChange={(event) =>
              update("blog_category_id", event.target.value)
            }
          >
            <option value="">Uncategorized</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label="Title" htmlFor="city-post-title">
          <input
            id="city-post-title"
            className={inputClass}
            value={form.title}
            onChange={(event) => update("title", event.target.value)}
            placeholder="A headline for the city"
            minLength={3}
            maxLength={200}
            required
          />
        </Field>
      </div>

      <div className="mt-4">
        <Field
          label="Summary"
          htmlFor="city-post-summary"
          hint="Optional short description shown in the blog directory."
        >
          <textarea
            id="city-post-summary"
            className={textareaClass}
            value={form.summary}
            onChange={(event) => update("summary", event.target.value)}
            maxLength={500}
          />
        </Field>
      </div>

      <div className="mt-4">
        <CoverImageInput
          value={form.cover_image_url || null}
          onChange={(url) => update("cover_image_url", url ?? "")}
        />
      </div>

      {form.post_type === "event" ? (
        <div className="mt-4 grid gap-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 sm:grid-cols-2">
          <Field label="Event starts" htmlFor="city-post-starts">
            <input
              id="city-post-starts"
              type="datetime-local"
              className={inputClass}
              value={form.event_starts_at}
              onChange={(event) =>
                update("event_starts_at", event.target.value)
              }
              required
            />
          </Field>
          <Field label="Event ends" htmlFor="city-post-ends">
            <input
              id="city-post-ends"
              type="datetime-local"
              className={inputClass}
              value={form.event_ends_at}
              onChange={(event) => update("event_ends_at", event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <div className="mt-4">
        <Field label="Body">
          <RichTextEditor
            value={form.body}
            onChange={(html) => update("body", html)}
          />
        </Field>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4">
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => update("is_published", event.target.checked)}
              disabled={!canPublish}
              className="h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50"
            />
            Published
          </label>
          {!canPublish ? (
            <p className="mt-1 text-xs text-amber-700">
              Approve this contributor post before it can be published.
            </p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={buttonClass("secondary", "sm")}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={buttonClass("primary", "sm")}
            disabled={saving}
          >
            {saving ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {post ? "Save changes" : "Publish post"}
          </button>
        </div>
      </div>
    </form>
  );
}
