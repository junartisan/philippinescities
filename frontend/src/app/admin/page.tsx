"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Banknote,
  ClipboardList,
  Clock3,
  FileText,
  MessageSquare,
  Newspaper,
  Sparkles,
  Store,
  UserCheck,
  Users,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import {
  Alert,
  EmptyState,
  PageLoader,
  StatusBadge,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { AdminStats, Business, BusinessList, Claim } from "@/lib/types";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, loading: authLoading } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const canEditContent = isAdmin || hasRole(user, "editor");
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingBusinesses, setPendingBusinesses] = useState<Business[]>([]);
  const [pendingClaims, setPendingClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authLoading || !user) return;
    let active = true;
    async function load() {
      try {
        const [statsData, businessData, claimData] = await Promise.all([
          api<AdminStats>("/api/admin/stats"),
          api<BusinessList>(
            "/api/admin/businesses?status=pending&page=1&page_size=5",
          ),
          isAdmin
            ? api<Claim[]>("/api/admin/claims?status=pending")
            : Promise.resolve([]),
        ]);
        if (!active) return;
        setStats(statsData);
        setPendingBusinesses(businessData.items);
        setPendingClaims(claimData.slice(0, 5));
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [authLoading, user, isAdmin]);

  if (loading) return <PageLoader label="Loading admin overview…" />;

  return (
    <div className="space-y-6">
      {error ? <Alert>{error}</Alert> : null}

      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Users"
            value={stats.users}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Listings"
            value={stats.businesses}
            icon={<Store className="h-4 w-4" />}
          />
          <StatCard
            label="Pending listings"
            value={stats.pending_businesses}
            icon={<Clock3 className="h-4 w-4" />}
          />
          {isAdmin ? (
            <StatCard
              label="Pending claims"
              value={stats.pending_claims}
              icon={<ClipboardList className="h-4 w-4" />}
            />
          ) : (
            <StatCard
              label="Reviews"
              value={stats.reviews}
              icon={<MessageSquare className="h-4 w-4" />}
            />
          )}
        </div>
      ) : null}

      {stats ? (
        <div
          className={
            isAdmin
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          }
        >
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Reviews
            </span>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {stats.reviews}
            </p>
          </div>
          {isAdmin ? (
            <>
              <Link
                href="/admin/payments"
                className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-violet-200"
              >
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  Pending payments
                  <Banknote className="h-4 w-4 text-violet-500" />
                </span>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.pending_manual_payments}
                </p>
              </Link>
              <Link
                href="/admin/featured"
                className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-violet-200"
              >
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  Featured requests
                  <Sparkles className="h-4 w-4 text-violet-500" />
                </span>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.pending_featured_requests}
                </p>
              </Link>
            </>
          ) : null}
          {canEditContent ? (
            <>
              <Link
                href="/admin/contributors"
                className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-violet-200"
              >
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  Contributor applications
                  <UserCheck className="h-4 w-4 text-violet-500" />
                </span>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.pending_contributors}
                </p>
              </Link>
              <Link
                href="/admin/blog"
                className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-violet-200"
              >
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  Blog posts to review
                  <FileText className="h-4 w-4 text-violet-500" />
                </span>
                <p className="mt-2 text-xl font-semibold text-slate-900">
                  {stats.pending_city_posts}
                </p>
              </Link>
              <Link
                href="/admin/articles"
                className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm transition hover:border-violet-200"
              >
                <span className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-slate-400">
                  Business articles
                  <Newspaper className="h-4 w-4 text-violet-500" />
                </span>
                <p className="mt-2 text-sm font-medium text-slate-500">
                  Manage all owner updates
                </p>
              </Link>
            </>
          ) : null}
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Categories
            </span>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {stats.categories}
            </p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Cities
            </span>
            <p className="mt-2 text-xl font-semibold text-slate-900">
              {stats.cities}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              Listings awaiting review
            </h2>
            <Link
              href="/admin/businesses"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Review all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {pendingBusinesses.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<Store className="h-5 w-5" />}
                title="Nothing to review"
                description="New listings will appear here for approval."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {pendingBusinesses.map((business) => (
                <li
                  key={business.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/businesses/${business.slug}`}
                      className="block truncate text-sm font-medium text-slate-800 hover:text-emerald-700"
                    >
                      {business.name}
                    </Link>
                    <p className="truncate text-xs text-slate-500">
                      {business.category.name} · {business.city.name} ·{" "}
                      {formatDate(business.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={business.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin ? (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Claims awaiting review
              </h2>
            <Link
              href="/admin/claims"
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Review all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {pendingClaims.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="No pending claims"
                description="Ownership requests will appear here."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-stone-100">
              {pendingClaims.map((claim) => (
                <li
                  key={claim.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {claim.business.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {claim.user.full_name} · {formatDate(claim.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={claim.status} />
                </li>
              ))}
            </ul>
          )}
          </section>
        ) : (
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Review moderation
              </h2>
              <Link
                href="/admin/reviews"
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Open reviews
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Reviews are published immediately. Remove reviews that violate
              community guidelines from the moderation queue.
            </p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">
              {stats?.reviews ?? 0}
            </p>
            <p className="text-xs text-slate-400">Total reviews</p>
          </section>
        )}
      </div>
    </div>
  );
}
