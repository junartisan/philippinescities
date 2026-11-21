"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Globe,
  Mail,
  MapPin,
  Newspaper,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { BusinessArticles } from "@/components/business-articles";
import { ClaimBox } from "@/components/claim-box";
import { ReviewSection } from "@/components/review-section";
import {
  Alert,
  Avatar,
  Badge,
  BusinessLogo,
  buttonClass,
  EmptyState,
  PageLoader,
  Stars,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Business } from "@/lib/types";

function websiteHref(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export default function BusinessDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user } = useAuth();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoading(true);
    api<Business>(`/api/businesses/slug/${slug}`)
      .then((data) => {
        if (active) {
          setBusiness(data);
          setError("");
        }
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
  }, [slug]);

  if (loading) return <PageLoader label="Loading business…" />;

  if (error || !business) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="Business not found"
          description={error || "This listing may have been removed or is not public yet."}
          action={
            <Link href="/businesses" className={buttonClass("primary", "sm")}>
              Back to directory
            </Link>
          }
        />
      </div>
    );
  }

  const canManage =
    Boolean(user) &&
    (user?.id === business.owner?.id || user?.role === "admin");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link
        href="/businesses"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition hover:text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to directory
      </Link>

      <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <BusinessLogo
            name={business.name}
            seed={business.id}
            logoUrl={business.logo_url}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {business.is_featured ? (
                <Badge tone="amber">Featured listing</Badge>
              ) : null}
              <Badge tone="emerald">{business.category.name}</Badge>
              <Badge>
                <MapPin className="h-3 w-3" />
                {business.city.name}
              </Badge>
              {business.is_claimed ? (
                <Badge tone="sky">
                  <CheckCircle2 className="h-3 w-3" />
                  Claimed
                </Badge>
              ) : (
                <Badge>Unclaimed</Badge>
              )}
              {canManage ? <Badge tone="violet">You can manage this</Badge> : null}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {business.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Stars
                rating={business.average_rating}
                count={business.review_count}
              />
              {business.address ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                  <MapPin className="h-4 w-4" />
                  {business.address}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {business.status === "approved" ? (
              <a
                href="#reviews"
                className={buttonClass("secondary", "sm")}
              >
                Read reviews
              </a>
            ) : null}
            {canManage && business.status === "approved" ? (
              <Link
                href={`/dashboard/listings/${business.id}/articles`}
                className={buttonClass("secondary", "sm")}
              >
                <Newspaper className="h-4 w-4" />
                Manage updates
              </Link>
            ) : null}
            {canManage ? (
              <Link
                href={`/dashboard/listings/${business.id}/edit`}
                className={buttonClass("primary", "sm")}
              >
                <Pencil className="h-4 w-4" />
                Edit listing
              </Link>
            ) : null}
          </div>
        </div>

        {business.status !== "approved" ? (
          <div className="mt-5">
            <Alert tone={business.status === "rejected" ? "error" : "warning"}>
              This listing is <strong>{business.status}</strong> and only visible
              to its owner and admins.
              {business.rejection_reason
                ? ` Admin note: ${business.rejection_reason}`
                : ""}
            </Alert>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">About</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">
              {business.description || "This business has not added a description yet."}
            </p>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Details</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Category
                </dt>
                <dd className="mt-1">
                  <Link
                    href={`/businesses?category_id=${business.category.id}`}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {business.category.name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Location
                </dt>
                <dd className="mt-1">
                  <Link
                    href={`/businesses?city_id=${business.city.id}`}
                    className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
                  >
                    {business.city.name}
                    {business.city.province ? `, ${business.city.province}` : ""}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Listed since
                </dt>
                <dd className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {formatDate(business.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Last updated
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  {formatDate(business.updated_at)}
                </dd>
              </div>
            </dl>
          </section>

          {business.status === "approved" ? (
            <BusinessArticles business={business} />
          ) : null}

          {business.status === "approved" ? (
            <ReviewSection business={business} />
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Contact</h2>
            <div className="mt-3 space-y-3 text-sm">
              {business.phone ? (
                <a
                  href={`tel:${business.phone}`}
                  className="flex items-center gap-2.5 text-slate-600 hover:text-emerald-700"
                >
                  <Phone className="h-4 w-4 text-slate-400" />
                  {business.phone}
                </a>
              ) : null}
              {business.email ? (
                <a
                  href={`mailto:${business.email}`}
                  className="flex items-center gap-2.5 break-all text-slate-600 hover:text-emerald-700"
                >
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                  {business.email}
                </a>
              ) : null}
              {business.website ? (
                <a
                  href={websiteHref(business.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2.5 break-all text-slate-600 hover:text-emerald-700"
                >
                  <Globe className="h-4 w-4 shrink-0 text-slate-400" />
                  {business.website}
                </a>
              ) : null}
              {!business.phone && !business.email && !business.website ? (
                <p className="text-sm text-slate-500">
                  No contact details have been added yet.
                </p>
              ) : null}
            </div>
          </div>

          {business.status === "approved" ? (
            <ClaimBox business={business} />
          ) : null}

          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Listing status
              </h2>
            </div>
            {business.owner ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar
                  name={business.owner.full_name}
                  seed={business.owner.id}
                  size="sm"
                />
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {business.owner.full_name}
                  </p>
                  <p className="text-xs text-slate-500">Verified owner</p>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">
                This listing is not claimed by an owner yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
