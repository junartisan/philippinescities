"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Globe,
  Mail,
  MapPin,
  Network,
  Newspaper,
  Pencil,
  Phone,
  ShieldCheck,
  Store,
  Tag,
  Users,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import { AdSlot } from "@/components/adsense";
import { BusinessArticles } from "@/components/business-articles";
import { BusinessVerificationBox } from "@/components/business-verification-box";
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
import type { Business, BusinessVerificationStatus } from "@/lib/types";

function roleLabel(role: Business["my_role"]) {
  if (role === "corporate_admin") return "Corporate admin";
  if (role === "branch_manager") return "Branch manager";
  if (role === "staff") return "Branch staff";
  if (role === "owner") return "Owner";
  return null;
}

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
    api<Business>(`/api/businesses/slug/${encodeURIComponent(slug)}`)
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

  const role = business.my_role;
  const canManage =
    Boolean(user) &&
    (Boolean(role) ||
      user?.id === business.owner?.id ||
      hasRole(user, "admin"));
  const canManageTeam = role === "owner" || role === "corporate_admin";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
          <li>
            <Link href="/" className="transition hover:text-emerald-700">
              Home
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <li>
            <Link
              href="/businesses"
              className="transition hover:text-emerald-700"
            >
              Business Directory
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <li>
            <Link
              href={`/cities/${business.city.slug}`}
              className="transition hover:text-emerald-700"
            >
              {business.city.name}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <li>
            <Link
              href={`/categories/${business.category.slug}`}
              className="transition hover:text-emerald-700"
            >
              {business.category.name}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <li aria-current="page" className="font-medium text-slate-700">
            {business.name}
          </li>
        </ol>
      </nav>

      {business.lineage.length > 1 ? (
        <nav
          aria-label="Brand hierarchy"
          className="mt-4 flex flex-wrap items-center gap-1.5 text-sm text-slate-500"
        >
          {business.lineage.map((item, index) => {
            const last = index === business.lineage.length - 1;
            return (
              <span key={item.id} className="inline-flex items-center gap-1.5">
                {last ? (
                  <span className="font-medium text-slate-700">{item.name}</span>
                ) : (
                  <Link
                    href={`/businesses/${item.slug}`}
                    className="hover:text-emerald-700"
                  >
                    {item.name}
                  </Link>
                )}
                {!last ? <ChevronRight className="h-3.5 w-3.5" /> : null}
              </span>
            );
          })}
        </nav>
      ) : null}

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
              {role ? <Badge tone="violet">{roleLabel(role)}</Badge> : null}
              {business.verification_status === "verified" ? (
                <Badge tone="emerald">
                  <ShieldCheck className="h-3 w-3" />
                  Verified
                </Badge>
              ) : business.verification_status === "pending" ? (
                <Badge tone="amber">Verification pending</Badge>
              ) : null}
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
            {canManageTeam ? (
              <Link
                href={`/dashboard/listings/${business.id}/team`}
                className={buttonClass("secondary", "sm")}
              >
                <Users className="h-4 w-4" />
                Manage team
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
                    href={`/categories/${business.category.slug}`}
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
                    href={`/cities/${business.city.slug}`}
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

          {business.branches.length > 0 ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <Network className="h-5 w-5 text-emerald-600" />
                <h2 className="text-lg font-semibold text-slate-900">
                  Branches under this brand
                </h2>
              </div>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {business.branches.map((branch) => (
                  <li key={branch.id}>
                    <Link
                      href={`/businesses/${branch.slug}`}
                      className="flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
                    >
                      <Store className="h-4 w-4 text-slate-400" />
                      {branch.name}
                      <ChevronRight className="ml-auto h-4 w-4" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {business.hours || business.promo_headline || business.promo_details ? (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Hours and local offers
              </h2>
              {business.hours ? (
                <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {business.hours}
                </p>
              ) : null}
              {business.promo_headline ? (
                <div className="mt-4 rounded-xl bg-emerald-50 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <Tag className="h-4 w-4" />
                    {business.promo_headline}
                  </p>
                  {business.promo_details ? (
                    <p className="mt-2 whitespace-pre-line text-sm text-emerald-700">
                      {business.promo_details}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>
          ) : null}

          {business.status === "approved" ? (
            <BusinessArticles business={business} />
          ) : null}

          {business.status === "approved" ? (
            <ReviewSection business={business} />
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Explore</h2>
            <div className="mt-3 space-y-2.5">
              <Link
                href={`/categories/${business.category.slug}`}
                className="flex items-center gap-2.5 text-sm text-slate-600 hover:text-emerald-700"
              >
                <Store className="h-4 w-4 text-slate-400" />
                More in {business.category.name}
              </Link>
              <Link
                href={`/cities/${business.city.slug}`}
                className="flex items-center gap-2.5 text-sm text-slate-600 hover:text-emerald-700"
              >
                <MapPin className="h-4 w-4 text-slate-400" />
                Explore {business.city.name}
              </Link>
            </div>
          </div>

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

          {role ? (
            <BusinessVerificationBox
              business={business}
              onSubmitted={(status: BusinessVerificationStatus) =>
                setBusiness((previous) =>
                  previous
                    ? { ...previous, verification_status: status }
                    : previous,
                )
              }
            />
          ) : null}

          <AdSlot
            slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_BUSINESS_DETAIL}
            format="rectangle"
            minHeight={250}
          />

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
