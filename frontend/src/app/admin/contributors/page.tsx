"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  CheckCircle2,
  MapPin,
  Pencil,
  RotateCcw,
  Save,
  Search,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  EmptyState,
  inputClass,
  PageLoader,
  selectClass,
  Spinner,
} from "@/components/ui";
import {
  CONTRIBUTOR_STATUS_LABELS,
  contributorStatusTone,
} from "@/lib/blog";
import { formatDate } from "@/lib/utils";
import type { BlogContributorProfile, City } from "@/lib/types";

export default function AdminContributorsPage() {
  const [profiles, setProfiles] = useState<BlogContributorProfile[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [editingCitiesId, setEditingCitiesId] = useState<number | null>(null);
  const [cityDraft, setCityDraft] = useState<number[]>([]);
  const [savingCities, setSavingCities] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    try {
      const data = await api<BlogContributorProfile[]>(
        `/api/admin/contributors?${params.toString()}`,
      );
      setProfiles(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<City[]>("/api/cities")
      .then(setCities)
      .catch((err) => setError(errorMessage(err)));
  }, []);

  function startCityEdit(profile: BlogContributorProfile) {
    setEditingCitiesId(profile.id);
    setCityDraft(profile.cities.map((city) => city.id));
  }

  function toggleCityDraft(cityId: number) {
    setCityDraft((previous) =>
      previous.includes(cityId)
        ? previous.filter((id) => id !== cityId)
        : [...previous, cityId],
    );
  }

  async function saveCities(profile: BlogContributorProfile) {
    setSavingCities(true);
    setError("");
    try {
      const updated = await api<BlogContributorProfile>(
        `/api/admin/contributors/${profile.id}/cities`,
        {
          method: "PATCH",
          body: { city_ids: cityDraft },
        },
      );
      setProfiles((previous) =>
        previous.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(`City access updated for ${updated.user.full_name}.`);
      setEditingCitiesId(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingCities(false);
    }
  }

  async function review(
    profile: BlogContributorProfile,
    action: "approve" | "reject",
  ) {
    if (action === "approve" && profile.cities.length === 0) {
      setError("Assign at least one city before approving this contributor.");
      return;
    }
    const notes =
      action === "reject"
        ? window.prompt("Optional notes for the applicant:", profile.admin_notes ?? "") ?? ""
        : "";
    setReviewingId(profile.id);
    setError("");
    try {
      const updated = await api<BlogContributorProfile>(
        `/api/admin/contributors/${profile.id}/${action}`,
        {
          method: "POST",
          body: { admin_notes: notes.trim() || null },
        },
      );
      setNotice(
        action === "approve"
          ? `${updated.user.full_name} is now an approved blog contributor.`
          : `${updated.user.full_name}’s contributor application was rejected.`,
      );
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReviewingId(null);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function resetFilters() {
    setSearchInput("");
    setSearch("");
    setStatus("");
  }

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
          City blog access
        </p>
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Blog contributors
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Approve users to write for specific cities, then add or remove their
          city access at any time. Contributor submissions still need a
          separate article approval before they appear publicly.
        </p>
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

      <form
        onSubmit={handleSearch}
        className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className={`${inputClass} pl-9`}
              placeholder="Search by name or email"
              aria-label="Search contributors"
            />
          </div>
          <select
            aria-label="Filter by contributor status"
            className={`${selectClass} sm:w-48`}
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button type="submit" className={buttonClass("primary")}>
            Search
          </button>
          {search || status ? (
            <button
              type="button"
              onClick={resetFilters}
              className={buttonClass("ghost", "sm")}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="mt-8">
          <PageLoader label="Loading contributors…" />
        </div>
      ) : profiles.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<UserCheck className="h-5 w-5" />}
            title="No contributor applications"
            description="Users who apply to write for the city blog will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {profiles.map((profile) => (
            <article
              key={profile.id}
              className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Avatar
                    name={profile.user.full_name}
                    seed={profile.user.id}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {profile.user.full_name}
                      </p>
                      <Badge tone={contributorStatusTone(profile.status)}>
                        {CONTRIBUTOR_STATUS_LABELS[profile.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500">{profile.user.email}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Applied {formatDate(profile.created_at)}
                    </p>
                    {profile.message ? (
                      <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-sm leading-6 text-slate-600">
                        {profile.message}
                      </p>
                    ) : null}
                    {profile.admin_notes ? (
                      <p className="mt-2 text-xs text-slate-500">
                        Admin notes: {profile.admin_notes}
                      </p>
                    ) : null}
                    <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          {profile.status === "approved"
                            ? "Approved cities"
                            : "Requested cities"}
                        </p>
                        {editingCitiesId === profile.id ? null : (
                          <button
                            type="button"
                            onClick={() => startCityEdit(profile)}
                            className={buttonClass("ghost", "sm")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit cities
                          </button>
                        )}
                      </div>
                      {editingCitiesId === profile.id ? (
                        <div className="mt-3">
                          <div className="grid max-h-52 gap-2 overflow-y-auto sm:grid-cols-2">
                            {cities.map((city) => (
                              <label
                                key={city.id}
                                className="flex cursor-pointer items-start gap-2 rounded-lg bg-white px-2 py-1.5 text-sm text-slate-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={cityDraft.includes(city.id)}
                                  onChange={() => toggleCityDraft(city.id)}
                                  className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <span>
                                  {city.name}
                                  {city.province ? `, ${city.province}` : ""}
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => saveCities(profile)}
                              className={buttonClass("primary", "sm")}
                              disabled={savingCities}
                            >
                              {savingCities ? (
                                <Spinner className="h-4 w-4" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save cities
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCitiesId(null)}
                              className={buttonClass("ghost", "sm")}
                              disabled={savingCities}
                            >
                              <X className="h-4 w-4" />
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {profile.cities.length ? (
                            profile.cities.map((city) => (
                              <Badge key={city.id} tone="emerald">
                                <MapPin className="h-3 w-3" />
                                {city.name}
                                {city.province ? `, ${city.province}` : ""}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-rose-600">
                              No cities assigned
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {profile.status !== "approved" ? (
                    <button
                      type="button"
                      onClick={() => review(profile, "approve")}
                      className={buttonClass("primary", "sm")}
                      disabled={reviewingId === profile.id}
                    >
                      {reviewingId === profile.id ? (
                        <Spinner className="h-4 w-4" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                  ) : null}
                  {profile.status !== "rejected" ? (
                    <button
                      type="button"
                      onClick={() => review(profile, "reject")}
                      className={buttonClass("ghost", "sm")}
                      disabled={reviewingId === profile.id}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
