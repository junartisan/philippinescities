"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import type {
  Business,
  BusinessBrief,
  Category,
  City,
} from "@/lib/types";
import {
  Alert,
  buttonClass,
  Field,
  inputClass,
  selectClass,
  Spinner,
  textareaClass,
} from "@/components/ui";

type EditableField =
  | "name"
  | "description"
  | "address"
  | "phone"
  | "email"
  | "website"
  | "logo_url"
  | "category_id"
  | "city_id"
  | "parent_id"
  | "hours"
  | "promo_headline"
  | "promo_details";

const BRAND_FIELDS: EditableField[] = [
  "name",
  "description",
  "category_id",
  "website",
  "logo_url",
];
const BRANCH_FIELDS: EditableField[] = [
  "address",
  "city_id",
  "phone",
  "email",
  "hours",
];
const PROMO_FIELDS: EditableField[] = ["promo_headline", "promo_details"];
const ALL_FIELDS: EditableField[] = [
  ...BRAND_FIELDS,
  ...BRANCH_FIELDS,
  ...PROMO_FIELDS,
  "parent_id",
];

interface FormState {
  parent_id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  category_id: string;
  city_id: string;
  hours: string;
  promo_headline: string;
  promo_details: string;
}

const emptyForm: FormState = {
  parent_id: "",
  name: "",
  description: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  category_id: "",
  city_id: "",
  hours: "",
  promo_headline: "",
  promo_details: "",
};

function formFromBusiness(business: Business): FormState {
  return {
    parent_id: business.parent_id ? String(business.parent_id) : "",
    name: business.name,
    description: business.description ?? "",
    address: business.address ?? "",
    phone: business.phone ?? "",
    email: business.email ?? "",
    website: business.website ?? "",
    logo_url: business.logo_url ?? "",
    category_id: String(business.category.id),
    city_id: String(business.city.id),
    hours: business.hours ?? "",
    promo_headline: business.promo_headline ?? "",
    promo_details: business.promo_details ?? "",
  };
}

function editableFields(business?: Business): Set<EditableField> {
  if (!business) return new Set(ALL_FIELDS);
  if (business.my_role === "owner") return new Set(ALL_FIELDS);
  if (business.my_role === "corporate_admin") {
    return new Set(
      business.parent_id
        ? [...BRAND_FIELDS, ...PROMO_FIELDS]
        : ALL_FIELDS,
    );
  }
  if (business.my_role === "branch_manager") {
    return new Set(
      business.parent_id
        ? [...BRANCH_FIELDS, ...PROMO_FIELDS]
        : PROMO_FIELDS,
    );
  }
  if (business.my_role === "staff") return new Set(PROMO_FIELDS);
  return new Set();
}

function roleLabel(role: Business["my_role"]) {
  if (role === "corporate_admin") return "corporate admin";
  if (role === "branch_manager") return "branch manager";
  if (role === "staff") return "branch staff";
  return "owner";
}

export function BusinessForm({ business }: { business?: Business }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [brands, setBrands] = useState<BusinessBrief[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(
    business ? formFromBusiness(business) : emptyForm,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const allowed = editableFields(business);
  const can = (field: EditableField) => allowed.has(field);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        const [categoryList, cityList] = await Promise.all([
          api<Category[]>("/api/categories"),
          api<City[]>("/api/cities"),
        ]);
        if (!active) return;
        setCategories(categoryList);
        setCities(cityList);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setOptionsLoading(false);
      }
    }
    void loadOptions();
    if (editableFields(business).has("parent_id")) {
      api<BusinessBrief[]>("/api/businesses/brand-options")
        .then((data) => {
          if (active) setBrands(data);
        })
        .catch(() => {
          if (active) setBrands([]);
        });
    }
    return () => {
      active = false;
    };
  }, [business]);

  function update(field: keyof FormState, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (can("name") && !form.name.trim()) {
      setError("Business name is required.");
      return;
    }
    if (can("category_id") && !form.category_id) {
      setError("Please choose a category.");
      return;
    }
    if (can("city_id") && !form.city_id) {
      setError("Please choose a city.");
      return;
    }

    const payload: Record<string, unknown> = {};
    function put(field: EditableField, value: unknown) {
      if (can(field)) payload[field] = value;
    }
    put("name", form.name.trim());
    put("description", form.description.trim() || null);
    put("address", form.address.trim() || null);
    put("phone", form.phone.trim() || null);
    put("email", form.email.trim() || null);
    put("website", form.website.trim() || null);
    put("logo_url", form.logo_url.trim() || null);
    put("category_id", Number(form.category_id));
    put("city_id", Number(form.city_id));
    put("hours", form.hours.trim() || null);
    put("promo_headline", form.promo_headline.trim() || null);
    put("promo_details", form.promo_details.trim() || null);
    if (can("parent_id")) {
      if (business) {
        put("parent_id", form.parent_id ? Number(form.parent_id) : null);
      } else if (form.parent_id) {
        put("parent_id", Number(form.parent_id));
      }
    }

    setSaving(true);
    try {
      if (business) {
        await api<Business>(`/api/businesses/${business.id}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await api<Business>("/api/businesses", {
          method: "POST",
          body: payload,
        });
      }
      router.push("/dashboard/listings");
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {business && business.status !== "approved" ? (
        <Alert tone={business.status === "rejected" ? "error" : "warning"}>
          This listing is currently <strong>{business.status}</strong>.
          {business.rejection_reason
            ? ` Admin note: ${business.rejection_reason}`
            : " An admin reviews new and updated listings before they go public."}
        </Alert>
      ) : null}

      {business && business.my_role && business.my_role !== "owner" ? (
        <Alert tone="info">
          Your {roleLabel(business.my_role)} access can update only the fields
          enabled below.
        </Alert>
      ) : null}

      {error ? <Alert>{error}</Alert> : null}

      {can("parent_id") ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Brand and branches
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a parent brand to create a branch listing. Leave it blank for
            a standalone business or parent brand.
          </p>
          <div className="mt-5">
            <Field
              label="Parent brand"
              htmlFor="parent_id"
              hint="Only approved parent brands you manage can be selected."
            >
              <select
                id="parent_id"
                className={selectClass}
                value={form.parent_id}
                onChange={(event) => update("parent_id", event.target.value)}
                disabled={optionsLoading}
              >
                <option value="">No parent brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Business details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Tell customers what your business offers and where to find it.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {can("name") ? (
            <div className="sm:col-span-2">
              <Field label="Business name" htmlFor="name">
                <input
                  id="name"
                  className={inputClass}
                  value={form.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="e.g. Cebu Lechon House"
                  required
                />
              </Field>
            </div>
          ) : null}
          {can("description") ? (
            <div className="sm:col-span-2">
              <Field
                label="Description"
                htmlFor="description"
                hint="A short description of your products, services, or specialties."
              >
                <textarea
                  id="description"
                  className={textareaClass}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  placeholder="What makes your business worth a visit?"
                />
              </Field>
            </div>
          ) : null}
          {can("category_id") ? (
            <Field label="Category" htmlFor="category_id">
              <select
                id="category_id"
                className={selectClass}
                value={form.category_id}
                onChange={(event) => update("category_id", event.target.value)}
                disabled={optionsLoading}
                required
              >
                <option value="">
                  {optionsLoading ? "Loading categories…" : "Select a category"}
                </option>
                {categories
                  .filter((category) => category.parent_id === null)
                  .map((parent) => (
                    <optgroup key={parent.id} label={parent.name}>
                      <option value={parent.id}>{parent.name} - all</option>
                      {categories
                        .filter((child) => child.parent_id === parent.id)
                        .map((child) => (
                          <option key={child.id} value={child.id}>
                            {child.name}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                {categories
                  .filter(
                    (category) =>
                      category.parent_id !== null &&
                      !categories.some((item) => item.id === category.parent_id),
                  )
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          {can("city_id") ? (
            <Field label="City" htmlFor="city_id">
              <select
                id="city_id"
                className={selectClass}
                value={form.city_id}
                onChange={(event) => update("city_id", event.target.value)}
                disabled={optionsLoading}
                required
              >
                <option value="">
                  {optionsLoading ? "Loading cities…" : "Select a city"}
                </option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                    {city.province ? `, ${city.province}` : ""}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {can("address") ? (
            <div className="sm:col-span-2">
              <Field label="Street address" htmlFor="address">
                <input
                  id="address"
                  className={inputClass}
                  value={form.address}
                  onChange={(event) => update("address", event.target.value)}
                  placeholder="Unit, street, barangay"
                />
              </Field>
            </div>
          ) : null}
        </div>
      </section>

      {can("phone") || can("email") || can("website") || can("logo_url") ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Contact and online presence
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Optional, but helpful for customers trying to reach you.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {can("phone") ? (
              <Field label="Phone" htmlFor="phone">
                <input
                  id="phone"
                  className={inputClass}
                  value={form.phone}
                  onChange={(event) => update("phone", event.target.value)}
                  placeholder="+63 9xx xxx xxxx"
                />
              </Field>
            ) : null}
            {can("email") ? (
              <Field label="Email" htmlFor="email">
                <input
                  id="email"
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="hello@business.ph"
                />
              </Field>
            ) : null}
            {can("website") ? (
              <Field label="Website" htmlFor="website">
                <input
                  id="website"
                  className={inputClass}
                  value={form.website}
                  onChange={(event) => update("website", event.target.value)}
                  placeholder="https://business.ph"
                />
              </Field>
            ) : null}
            {can("logo_url") ? (
              <Field
                label="Logo URL"
                htmlFor="logo_url"
                hint="Paste a link to a square logo image."
              >
                <input
                  id="logo_url"
                  className={inputClass}
                  value={form.logo_url}
                  onChange={(event) => update("logo_url", event.target.value)}
                  placeholder="https://…/logo.png"
                />
              </Field>
            ) : null}
          </div>
        </section>
      ) : null}

      {can("hours") || can("promo_headline") || can("promo_details") ? (
        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Hours and local promotions
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Branch managers can update local hours and promotions. Corporate
            admins can update promotions across all branches.
          </p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {can("hours") ? (
              <Field
                label="Opening hours"
                htmlFor="hours"
                hint="Example: Mon-Fri 9am-6pm, Sat 10am-4pm"
              >
                <input
                  id="hours"
                  className={inputClass}
                  value={form.hours}
                  onChange={(event) => update("hours", event.target.value)}
                  placeholder="Mon-Fri 9am-6pm"
                />
              </Field>
            ) : null}
            {can("promo_headline") ? (
              <Field label="Promo headline" htmlFor="promo_headline">
                <input
                  id="promo_headline"
                  className={inputClass}
                  value={form.promo_headline}
                  onChange={(event) => update("promo_headline", event.target.value)}
                  placeholder="Weekend promo"
                />
              </Field>
            ) : null}
            {can("promo_details") ? (
              <div className="sm:col-span-2">
                <Field label="Promo details" htmlFor="promo_details">
                  <textarea
                    id="promo_details"
                    className={textareaClass}
                    value={form.promo_details}
                    onChange={(event) => update("promo_details", event.target.value)}
                    placeholder="Tell customers about this branch offer."
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/dashboard/listings"
          className={buttonClass("secondary")}
        >
          Cancel
        </Link>
        <button
          type="submit"
          className={buttonClass("primary")}
          disabled={saving || optionsLoading || allowed.size === 0}
        >
          {saving ? <Spinner className="h-4 w-4" /> : null}
          {business ? "Save changes" : "Submit listing"}
        </button>
      </div>
    </form>
  );
}
