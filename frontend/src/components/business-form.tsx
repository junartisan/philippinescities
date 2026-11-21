"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, errorMessage } from "@/lib/api";
import type {
  Business,
  BusinessPayload,
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

interface FormState {
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo_url: string;
  category_id: string;
  city_id: string;
}

const emptyForm: FormState = {
  name: "",
  description: "",
  address: "",
  phone: "",
  email: "",
  website: "",
  logo_url: "",
  category_id: "",
  city_id: "",
};

function formFromBusiness(business: Business): FormState {
  return {
    name: business.name,
    description: business.description ?? "",
    address: business.address ?? "",
    phone: business.phone ?? "",
    email: business.email ?? "",
    website: business.website ?? "",
    logo_url: business.logo_url ?? "",
    category_id: String(business.category.id),
    city_id: String(business.city.id),
  };
}

export function BusinessForm({ business }: { business?: Business }) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [form, setForm] = useState<FormState>(
    business ? formFromBusiness(business) : emptyForm,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
    return () => {
      active = false;
    };
  }, []);

  function update(field: keyof FormState, value: string) {
    setForm((previous) => ({ ...previous, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Business name is required.");
      return;
    }
    if (!form.category_id) {
      setError("Please choose a category.");
      return;
    }
    if (!form.city_id) {
      setError("Please choose a city.");
      return;
    }

    const payload: BusinessPayload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      address: form.address.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      logo_url: form.logo_url.trim() || null,
      category_id: Number(form.category_id),
      city_id: Number(form.city_id),
    };

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

      {error ? <Alert>{error}</Alert> : null}

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Business details
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Tell customers what your business offers and where to find it.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
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
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
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
        </div>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">
          Contact and online presence
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Optional, but helpful for customers trying to reach you.
        </p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field label="Phone" htmlFor="phone">
            <input
              id="phone"
              className={inputClass}
              value={form.phone}
              onChange={(event) => update("phone", event.target.value)}
              placeholder="+63 9xx xxx xxxx"
            />
          </Field>
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
          <Field label="Website" htmlFor="website">
            <input
              id="website"
              className={inputClass}
              value={form.website}
              onChange={(event) => update("website", event.target.value)}
              placeholder="https://business.ph"
            />
          </Field>
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
        </div>
      </section>

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
          disabled={saving || optionsLoading}
        >
          {saving ? <Spinner className="h-4 w-4" /> : null}
          {business ? "Save changes" : "Submit listing"}
        </button>
      </div>
    </form>
  );
}
