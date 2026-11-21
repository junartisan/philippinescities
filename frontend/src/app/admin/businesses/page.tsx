"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Check,
  CreditCard,
  Search,
  Store,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import {
  Alert,
  Badge,
  buttonClass,
  BusinessLogo,
  EmptyState,
  inputClass,
  Pagination,
  PageLoader,
  Spinner,
  StatusBadge,
  textareaClass,
} from "@/components/ui";
import { cn, formatDate } from "@/lib/utils";
import type { BusinessList, BusinessStatus } from "@/lib/types";

type StatusFilter = BusinessStatus | "all";

const tabs: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "all", label: "All" },
];

export default function AdminBusinessesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<BusinessList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (appliedSearch) params.set("search", appliedSearch);
      params.set("page", String(page));
      params.set("page_size", "10");
      const result = await api<BusinessList>(
        `/api/admin/businesses?${params.toString()}`,
      );
      setData(result);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, appliedSearch, page]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
    setNotice("");
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedSearch(search.trim());
    setPage(1);
  }

  async function approve(id: number) {
    setBusyId(id);
    setNotice("");
    try {
      await api(`/api/admin/businesses/${id}/approve`, { method: "POST" });
      setNotice("Listing approved.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function reject(id: number) {
    setBusyId(id);
    setNotice("");
    try {
      await api(`/api/admin/businesses/${id}/reject`, {
        method: "POST",
        body: { reason: reason.trim() || null },
      });
      setNotice("Listing rejected.");
      setRejectId(null);
      setReason("");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Listing moderation</h2>
        <p className="mt-1 text-sm text-slate-500">
          Approve listings so they appear in the directory, or reject them with a
          note for the owner.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => changeStatus(tab.value)}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              status === tab.value
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 ring-1 ring-inset ring-stone-200 hover:text-slate-900",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn(inputClass, "pl-9")}
            placeholder="Search listings by name or address"
          />
        </div>
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </form>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {loading ? (
        <PageLoader label="Loading listings…" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState
          icon={<Store className="h-5 w-5" />}
          title="No listings in this view"
          description="Try another status filter or clear the search."
        />
      ) : (
        <ul className="space-y-3">
          {data.items.map((business) => (
            <li
              key={business.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex gap-4">
                  <BusinessLogo
                    name={business.name}
                    seed={business.id}
                    logoUrl={business.logo_url}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/businesses/${business.slug}`}
                        className="text-base font-semibold text-slate-900 hover:text-emerald-700"
                      >
                        {business.name}
                      </Link>
                      <StatusBadge status={business.status} />
                      {business.is_featured ? (
                        <Badge tone="amber">Featured</Badge>
                      ) : null}
                      {business.is_paid ? (
                        <Badge tone="emerald">Subscription active</Badge>
                      ) : business.article_access_override === "rejected" ? (
                        <Badge tone="rose">Subscription off</Badge>
                      ) : business.article_access_override === "approved" ? (
                        <Badge tone="amber">Subscription approved</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {business.category.name} · {business.city.name}
                      {business.city.province
                        ? `, ${business.city.province}`
                        : ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Owner: {business.owner?.full_name ?? "Unclaimed"} ·
                      Submitted {formatDate(business.created_at)}
                    </p>
                    {business.rejection_reason ? (
                      <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        Rejection note: {business.rejection_reason}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  {isAdmin ? (
                    <Link
                      href={`/admin/businesses/${business.id}`}
                      className={buttonClass("secondary", "sm")}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      Subscription
                    </Link>
                  ) : null}
                  <Link
                    href={`/businesses/${business.slug}`}
                    className={buttonClass("ghost", "sm")}
                  >
                    View
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  {business.status !== "approved" ? (
                    <button
                      type="button"
                      onClick={() => approve(business.id)}
                      disabled={busyId === business.id}
                      className={buttonClass("primary", "sm")}
                    >
                      {busyId === business.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      )}
                      Approve
                    </button>
                  ) : null}
                  {business.status !== "rejected" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setRejectId(business.id);
                        setReason("");
                      }}
                      className={buttonClass("secondary", "sm", "text-rose-600 hover:border-rose-200 hover:text-rose-700")}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </button>
                  ) : null}
                </div>
              </div>

              {rejectId === business.id ? (
                <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                  <textarea
                    className={textareaClass}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder="Reason for rejection (optional, shown to the owner)"
                    maxLength={500}
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => reject(business.id)}
                      disabled={busyId === business.id}
                      className={buttonClass("danger", "sm")}
                    >
                      {busyId === business.id ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : null}
                      Confirm rejection
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectId(null)}
                      className={buttonClass("ghost", "sm")}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : null}
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
