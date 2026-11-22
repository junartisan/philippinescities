"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, Award, MapPin, Save } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  EmptyState,
  Field,
  inputClass,
  PageLoader,
  Spinner,
  textareaClass,
} from "@/components/ui";
import type { BlogContributorProfile, ContributorStatus } from "@/lib/types";

type FormState = {
  headline: string;
  bio: string;
  credentials: string;
};

export default function BlogProfileClient() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ContributorStatus | null>(null);
  const [profile, setProfile] = useState<BlogContributorProfile | null>(null);
  const [form, setForm] = useState<FormState>({
    headline: "",
    bio: "",
    credentials: "",
  });
  const [statusLoading, setStatusLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api<ContributorStatus>("/api/contributor/status")
      .then((data) => {
        if (active) setStatus(data);
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (status?.status !== "approved") return;
    let active = true;
    setProfileLoading(true);
    api<BlogContributorProfile>("/api/contributor/profile")
      .then((data) => {
        if (!active) return;
        setProfile(data);
        setForm({
          headline: data.headline ?? "",
          bio: data.bio ?? "",
          credentials: data.credentials ?? "",
        });
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setProfileLoading(false);
      });
    return () => {
      active = false;
    };
  }, [status]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const updated = await api<BlogContributorProfile>("/api/contributor/profile", {
        method: "PATCH",
        body: {
          headline: form.headline.trim() || null,
          bio: form.bio.trim() || null,
          credentials: form.credentials.trim() || null,
        },
      });
      setProfile(updated);
      setNotice("Your public writer credential has been updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (statusLoading) return <PageLoader label="Checking contributor access…" />;

  if (status?.status !== "approved") {
    return (
      <EmptyState
        icon={<Award className="h-5 w-5" />}
        title="Approved contributors only"
        description="Your writer profile becomes available after your city blog contributor application is approved."
        action={
          <Link href="/contributor" className={buttonClass("primary", "sm")}>
            Go to contributor access
          </Link>
        }
      />
    );
  }

  if (profileLoading || !profile) {
    return <PageLoader label="Loading writer profile…" />;
  }

  const displayName = user?.full_name ?? profile.user.full_name;

  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Dashboard overview
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Award className="h-4 w-4" />
            Public writer profile
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            Credential summary
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            This information appears on your city blog posts for all readers.
          </p>
        </div>
        <Badge tone="emerald">Approved writer</Badge>
      </div>

      {error ? <div className="mt-5"><Alert>{error}</Alert></div> : null}
      {notice ? (
        <div className="mt-5">
          <Alert tone="success">{notice}</Alert>
        </div>
      ) : null}

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          <Field
            label="Headline"
            htmlFor="writer-headline"
            hint="A short public title, such as Local culture writer."
          >
            <input
              id="writer-headline"
              className={inputClass}
              value={form.headline}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, headline: event.target.value }))
              }
              maxLength={120}
              placeholder="Local culture writer"
            />
          </Field>
          <Field
            label="Short bio"
            htmlFor="writer-bio"
            hint="A brief introduction shown with your posts."
          >
            <textarea
              id="writer-bio"
              className={textareaClass}
              value={form.bio}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, bio: event.target.value }))
              }
              maxLength={1000}
              rows={4}
              placeholder="I cover community stories, travel guides, and local events."
            />
          </Field>
          <Field
            label="Credentials"
            htmlFor="writer-credentials"
            hint="Experience, qualifications, or publication history."
          >
            <textarea
              id="writer-credentials"
              className={textareaClass}
              value={form.credentials}
              onChange={(event) =>
                setForm((previous) => ({ ...previous, credentials: event.target.value }))
              }
              maxLength={1000}
              rows={4}
              placeholder="Five years covering local news and city guides."
            />
          </Field>
          <div className="flex justify-end">
            <button
              type="submit"
              className={buttonClass("primary", "sm")}
              disabled={saving}
            >
              {saving ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              Save profile
            </button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Reader preview</h3>
            <div className="mt-4 flex items-center gap-3">
              <Avatar
                name={displayName}
                seed={profile.user_id}
                url={user?.avatar_url ?? undefined}
                size="sm"
              />
              <div>
                <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                <p className="text-xs text-slate-500">
                  {form.headline.trim() || "City blog author"}
                </p>
              </div>
            </div>
            {form.credentials.trim() ? (
              <p className="mt-4 whitespace-pre-line text-xs leading-5 text-emerald-800">
                {form.credentials}
              </p>
            ) : null}
            {form.bio.trim() ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">{form.bio}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-1.5">
              {profile.cities.map((city) => (
                <span
                  key={city.id}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-slate-600"
                >
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  {city.name}
                </span>
              ))}
            </div>
          </div>
          <Alert tone="info">
            Admin notes and your contributor application message are never shown publicly.
          </Alert>
        </aside>
      </div>
    </div>
  );
}
