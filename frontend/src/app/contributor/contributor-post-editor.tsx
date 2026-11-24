"use client";

import { useState, type FormEvent } from "react";
import { Save, Send, X } from "lucide-react";
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
  CityPostType,
  ContributorPostPayload,
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

function initialForm(post: CityPost | null, cities: City[]): FormState {
  const postCityAllowed =
    post !== null &&
    (post.city_id === null || cities.some((city) => city.id === post.city_id));
  return {
    city_id: postCityAllowed && post?.city_id ? String(post.city_id) : "",
    blog_category_id: String(post?.blog_category_id ?? ""),
    title: post?.title ?? "",
    summary: post?.summary ?? "",
    body: post?.body ?? "",
    cover_image_url: post?.cover_image_url ?? "",
    post_type: post?.post_type ?? "article",
    event_starts_at: toLocalInput(post?.event_starts_at ?? null),
    event_ends_at: toLocalInput(post?.event_ends_at ?? null),
  };
}

export function ContributorPostEditor({
  post,
  cities,
  categories,
  onSaved,
  onCancel,
}: {
  post: CityPost | null;
  cities: City[];
  categories: BlogCategory[];
  onSaved: (post: CityPost, submitted: boolean) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(post, cities));
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [error, setError] = useState("");

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  async function save(submitForReview: boolean) {
    if (form.post_type === "event" && !form.event_starts_at) {
      setError("Events need a start date and time.");
      return;
    }
    setSaving(submitForReview ? "submit" : "draft");
    setError("");
    const payload: ContributorPostPayload = {
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
      submit_for_review: submitForReview,
    };
    try {
      const saved = post
        ? await api<CityPost>(`/api/contributor/posts/${post.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await api<CityPost>("/api/contributor/posts", {
            method: "POST",
            body: payload,
          });
      onSaved(saved, submitForReview);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
            {post ? "Edit submission" : "New submission"}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
            {post ? post.title : "Write for a city"}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Save a draft or submit it to the admin review queue.
          </p>
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
          htmlFor="contributor-city"
          hint="Choose an assigned city, or leave as All Philippines for a general article."
        >
          <select
            id="contributor-city"
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
        <Field label="Post type" htmlFor="contributor-type">
          <select
            id="contributor-type"
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
          htmlFor="contributor-category"
          hint="Optional. Helps readers find related city stories."
        >
          <select
            id="contributor-category"
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
        <Field label="Title" htmlFor="contributor-title">
          <input
            id="contributor-title"
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
          htmlFor="contributor-summary"
          hint="Optional short description shown in the blog directory."
        >
          <textarea
            id="contributor-summary"
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
          <Field label="Event starts" htmlFor="contributor-starts">
            <input
              id="contributor-starts"
              type="datetime-local"
              className={inputClass}
              value={form.event_starts_at}
              onChange={(event) =>
                update("event_starts_at", event.target.value)
              }
              required
            />
          </Field>
          <Field label="Event ends" htmlFor="contributor-ends">
            <input
              id="contributor-ends"
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

      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className={buttonClass("ghost", "sm")}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void save(false)}
          className={buttonClass("secondary", "sm")}
          disabled={saving !== null}
        >
          {saving === "draft" ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save draft
        </button>
        <button
          type="submit"
          className={buttonClass("primary", "sm")}
          disabled={saving !== null}
        >
          {saving === "submit" ? (
            <Spinner className="h-4 w-4" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Submit for review
        </button>
      </div>
    </form>
  );
}
