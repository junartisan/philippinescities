"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CreditCard,
  Newspaper,
  Plus,
  ShieldCheck,
  Store,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { hasRole } from "@/lib/roles";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  Field,
  inputClass,
  PageLoader,
  Spinner,
} from "@/components/ui";
import { formatDate } from "@/lib/utils";
import type { Business, Claim, User } from "@/lib/types";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </span>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, updateUser } = useAuth();
  const [listings, setListings] = useState<Business[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");
  const isAdmin = hasRole(user, "admin");
  const isEditor = hasRole(user, "editor");
  const isSupervisor = hasRole(user, "supervisor");
  const canAccessAdmin = isAdmin || isEditor || isSupervisor;
  const roleLabel = isAdmin
    ? "Administrator"
    : isEditor
      ? "Editor"
      : isSupervisor
        ? "Supervisor"
        : hasRole(user, "owner")
          ? "Business owner"
          : "Member";
  const consoleLabel = isAdmin
    ? "Admin console"
    : isEditor
      ? "Editor console"
      : "Supervisor console";

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function load() {
      try {
        const [mine, myClaims] = await Promise.all([
          api<Business[]>("/api/businesses/mine"),
          api<Claim[]>("/api/claims/mine"),
        ]);
        if (!active) return;
        setListings(mine);
        setClaims(myClaims);
      } catch (err) {
        if (active) setLoadError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [user]);

  if (!user) return null;

  const pendingListings = listings.filter(
    (listing) => listing.status === "pending",
  ).length;
  const approvedListings = listings.filter(
    (listing) => listing.status === "approved",
  ).length;
  const pendingClaims = claims.filter((claim) => claim.status === "pending").length;

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setProfileError("");
    setProfileNotice("");
    if (!fullName.trim()) {
      setProfileError("Full name is required.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api<User>("/api/auth/me", {
        method: "PATCH",
        body: {
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          ...(password ? { password } : {}),
        },
      });
      updateUser(updated);
      setPassword("");
      setProfileNotice("Profile updated.");
    } catch (err) {
      setProfileError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading your dashboard…" />;

  return (
    <div className="space-y-6">
      {loadError ? <Alert>{loadError}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="My listings"
          value={listings.length}
          icon={<Store className="h-4 w-4" />}
        />
        <StatCard
          label="Pending review"
          value={pendingListings}
          icon={<Clock3 className="h-4 w-4" />}
        />
        <StatCard
          label="Approved"
          value={approvedListings}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label="Claims pending"
          value={pendingClaims}
          icon={<ClipboardList className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Profile details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              This is how you appear on reviews and ownership requests.
            </p>

            <form onSubmit={saveProfile} className="mt-5 space-y-4">
              {profileError ? <Alert>{profileError}</Alert> : null}
              {profileNotice ? (
                <Alert tone="success">{profileNotice}</Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="full_name">
                  <input
                    id="full_name"
                    className={inputClass}
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    required
                    minLength={2}
                  />
                </Field>
                <Field label="Phone" htmlFor="phone">
                  <input
                    id="phone"
                    className={inputClass}
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+63 9xx xxx xxxx"
                  />
                </Field>
                <Field
                  label="Email"
                  htmlFor="email"
                  hint="Email changes are not supported yet."
                >
                  <input
                    id="email"
                    className={inputClass}
                    value={user.email}
                    disabled
                  />
                </Field>
                <Field
                  label="New password"
                  htmlFor="password"
                  hint="Leave blank to keep your current password."
                >
                  <input
                    id="password"
                    type="password"
                    className={inputClass}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className={buttonClass("primary", "sm")}
                  disabled={saving}
                >
                  {saving ? <Spinner className="h-4 w-4" /> : null}
                  Save profile
                </button>
              </div>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <Avatar name={user.full_name} seed={user.id} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.full_name}
                </p>
                <p className="truncate text-xs text-slate-500">{user.email}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge
                tone={isAdmin ? "violet" : isEditor || isSupervisor ? "sky" : "emerald"}
              >
                {roleLabel}
              </Badge>
              <Badge>Joined {formatDate(user.created_at)}</Badge>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <div className="mt-3 space-y-1">
              <Link
                href="/dashboard/listings"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <Store className="h-4 w-4 text-slate-400" />
                  Manage listings
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              <Link
                href="/dashboard/billing"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-slate-400" />
                  Billing & payments
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              <Link
                href="/dashboard/claims"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-slate-400" />
                  View my claims
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              <Link
                href="/dashboard/listings/new"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4 text-slate-400" />
                  Add a listing
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              <Link
                href="/contributor"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <Newspaper className="h-4 w-4 text-slate-400" />
                  City blog contributor
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              <Link
                href="/dashboard/blog-profile"
                className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
              >
                <span className="inline-flex items-center gap-2">
                  <Award className="h-4 w-4 text-slate-400" />
                  Writer profile
                </span>
                <ArrowRight className="h-4 w-4 text-stone-300" />
              </Link>
              {canAccessAdmin ? (
                <Link
                  href="/admin"
                  className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-stone-50 hover:text-slate-900"
                >
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-slate-400" />
                    {consoleLabel}
                  </span>
                  <ArrowRight className="h-4 w-4 text-stone-300" />
                </Link>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
