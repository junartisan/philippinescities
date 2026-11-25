"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { MapPin, Pencil, Plus, Shapes, Tags, Trash2, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CategoryIcon } from "@/components/category-icon";
import {
  Alert,
  buttonClass,
  EmptyState,
  Field,
  inputClass,
  PageLoader,
  selectClass,
  Spinner,
} from "@/components/ui";
import type { BlogCategory, Category, City } from "@/lib/types";

type CategoryFormState = {
  name: string;
  description: string;
  parent_id: number | null;
};

const emptyCategory: CategoryFormState = {
  name: "",
  description: "",
  parent_id: null,
};
const emptyBlogCategory = { name: "", description: "" };
const emptyCity = { name: "", province: "", region: "" };

export default function AdminTaxonomyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [blogCategories, setBlogCategories] = useState<BlogCategory[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [blogCategoryForm, setBlogCategoryForm] = useState(emptyBlogCategory);
  const [cityForm, setCityForm] = useState(emptyCity);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBlogCategory, setEditingBlogCategory] =
    useState<BlogCategory | null>(null);
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [categoryList, blogCategoryList, cityList] = await Promise.all([
        api<Category[]>("/api/categories"),
        api<BlogCategory[]>("/api/blog-categories"),
        api<City[]>("/api/cities"),
      ]);
      setCategories(categoryList);
      setBlogCategories(blogCategoryList);
      setCities(cityList);
      setError("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryForm.name.trim();
    if (name.length < 2) return;
    setBusy("category");
    setNotice("");
    try {
      await api(
        editingCategory
          ? `/api/categories/${editingCategory.id}`
          : "/api/categories",
        {
          method: editingCategory ? "PATCH" : "POST",
          body: {
            name,
            description: categoryForm.description.trim() || null,
            parent_id: categoryForm.parent_id,
          },
        },
      );
      setNotice(editingCategory ? "Category updated." : "Category created.");
      setCategoryForm(emptyCategory);
      setEditingCategory(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function submitBlogCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = blogCategoryForm.name.trim();
    if (name.length < 2) return;
    setBusy("blog-category");
    setNotice("");
    try {
      await api(
        editingBlogCategory
          ? `/api/admin/blog-categories/${editingBlogCategory.id}`
          : "/api/admin/blog-categories",
        {
          method: editingBlogCategory ? "PATCH" : "POST",
          body: {
            name,
            description: blogCategoryForm.description.trim() || null,
          },
        },
      );
      setNotice(
        editingBlogCategory
          ? "Blog category updated."
          : "Blog category created.",
      );
      setBlogCategoryForm(emptyBlogCategory);
      setEditingBlogCategory(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function submitCity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = cityForm.name.trim();
    if (name.length < 2) return;
    setBusy("city");
    setNotice("");
    try {
      await api(editingCity ? `/api/cities/${editingCity.id}` : "/api/cities", {
        method: editingCity ? "PATCH" : "POST",
        body: {
          name,
          province: cityForm.province.trim() || null,
          region: cityForm.region.trim() || null,
        },
      });
      setNotice(editingCity ? "City updated." : "City created.");
      setCityForm(emptyCity);
      setEditingCity(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Delete the category "${category.name}"?`)) return;
    setBusy(`category-${category.id}`);
    setNotice("");
    try {
      await api(`/api/categories/${category.id}`, { method: "DELETE" });
      if (editingCategory?.id === category.id) {
        setEditingCategory(null);
        setCategoryForm(emptyCategory);
      }
      setNotice("Category deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function removeBlogCategory(category: BlogCategory) {
    if (
      !window.confirm(
        `Delete the blog category "${category.name}"? Categories still used by posts cannot be deleted.`,
      )
    ) {
      return;
    }
    setBusy(`blog-category-${category.id}`);
    setNotice("");
    try {
      await api(`/api/admin/blog-categories/${category.id}`, {
        method: "DELETE",
      });
      if (editingBlogCategory?.id === category.id) {
        setEditingBlogCategory(null);
        setBlogCategoryForm(emptyBlogCategory);
      }
      setNotice("Blog category deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function removeCity(city: City) {
    if (
      !window.confirm(
        `Delete "${city.name}${city.province ? `, ${city.province}` : ""}"?`,
      )
    ) {
      return;
    }
    setBusy(`city-${city.id}`);
    setNotice("");
    try {
      await api(`/api/cities/${city.id}`, { method: "DELETE" });
      if (editingCity?.id === city.id) {
        setEditingCity(null);
        setCityForm(emptyCity);
      }
      setNotice("City deleted.");
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  function editCategory(category: Category) {
    setEditingCategory(category);
    setCategoryForm({
      name: category.name,
      description: category.description ?? "",
      parent_id: category.parent_id,
    });
    setError("");
  }

  function editBlogCategory(category: BlogCategory) {
    setEditingBlogCategory(category);
    setBlogCategoryForm({
      name: category.name,
      description: category.description ?? "",
    });
    setError("");
  }

  function editCity(city: City) {
    setEditingCity(city);
    setCityForm({
      name: city.name,
      province: city.province ?? "",
      region: city.region ?? "",
    });
    setError("");
  }

  if (loading) return <PageLoader label="Loading categories and cities…" />;

  const parentOptions = categories.filter(
    (category) =>
      category.parent_id === null &&
      category.id !== editingCategory?.id &&
      (category.child_count === 0 || category.id === categoryForm.parent_id),
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">
          Categories & cities
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Keep the filters current. Business categories, blog categories, or
          cities that are still in use cannot be deleted.
        </p>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Shapes className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Categories
              </h3>
              <p className="text-xs text-slate-500">
                {categories.length} categories
              </p>
            </div>
          </div>

          <form onSubmit={submitCategory} className="mt-4 space-y-3">
            <Field label="Name" htmlFor="category-name">
              <input
                id="category-name"
                className={inputClass}
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Coffee shops"
                maxLength={100}
                required
                minLength={2}
              />
            </Field>
            <Field label="Parent category" htmlFor="category-parent">
              <select
                id="category-parent"
                className={selectClass}
                value={categoryForm.parent_id ?? ""}
                onChange={(event) =>
                  setCategoryForm((previous) => ({
                    ...previous,
                    parent_id: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              >
                <option value="">Top-level category</option>
                {parentOptions.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Description" htmlFor="category-description">
              <input
                id="category-description"
                className={inputClass}
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional short description"
                maxLength={500}
              />
            </Field>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === "category"}
                className={buttonClass("primary", "sm")}
              >
                {busy === "category" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : editingCategory ? (
                  <Pencil className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {editingCategory ? "Save category" : "Add category"}
              </button>
              {editingCategory ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategory(null);
                    setCategoryForm(emptyCategory);
                  }}
                  className={buttonClass("ghost", "sm")}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {categories.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<Shapes className="h-5 w-5" />}
                title="No categories yet"
                description="Add the first category above."
              />
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-stone-100 border-t border-stone-100">
              {categories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-slate-600">
                      <CategoryIcon slug={category.slug} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {category.name}
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {category.parent_id ? "Subcategory · " : ""}/{category.slug}
                        {category.description
                          ? ` · ${category.description}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => editCategory(category)}
                      aria-label={`Edit ${category.name}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCategory(category)}
                      disabled={busy === `category-${category.id}`}
                      aria-label={`Delete ${category.name}`}
                      className={buttonClass(
                        "ghost",
                        "sm",
                        "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
                      )}
                    >
                      {busy === `category-${category.id}` ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
              <MapPin className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Cities</h3>
              <p className="text-xs text-slate-500">{cities.length} cities</p>
            </div>
          </div>

          <form onSubmit={submitCity} className="mt-4 space-y-3">
            <Field label="Name" htmlFor="city-name">
              <input
                id="city-name"
                className={inputClass}
                value={cityForm.name}
                onChange={(event) =>
                  setCityForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Cebu City"
                maxLength={120}
                required
                minLength={2}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Province" htmlFor="city-province">
                <input
                  id="city-province"
                  className={inputClass}
                  value={cityForm.province}
                  onChange={(event) =>
                    setCityForm((previous) => ({
                      ...previous,
                      province: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  maxLength={120}
                />
              </Field>
              <Field label="Region" htmlFor="city-region">
                <input
                  id="city-region"
                  className={inputClass}
                  value={cityForm.region}
                  onChange={(event) =>
                    setCityForm((previous) => ({
                      ...previous,
                      region: event.target.value,
                    }))
                  }
                  placeholder="Optional"
                  maxLength={120}
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === "city"}
                className={buttonClass("primary", "sm")}
              >
                {busy === "city" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : editingCity ? (
                  <Pencil className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {editingCity ? "Save city" : "Add city"}
              </button>
              {editingCity ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingCity(null);
                    setCityForm(emptyCity);
                  }}
                  className={buttonClass("ghost", "sm")}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {cities.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<MapPin className="h-5 w-5" />}
                title="No cities yet"
                description="Add the first city above."
              />
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-stone-100 border-t border-stone-100">
              {cities.map((city) => (
                <li
                  key={city.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {city.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      {[city.province, city.region].filter(Boolean).join(" · ") ||
                        "No province or region"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => editCity(city)}
                      aria-label={`Edit ${city.name}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeCity(city)}
                      disabled={busy === `city-${city.id}`}
                      aria-label={`Delete ${city.name}`}
                      className={buttonClass(
                        "ghost",
                        "sm",
                        "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
                      )}
                    >
                      {busy === `city-${city.id}` ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <Tags className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Blog categories
              </h3>
              <p className="text-xs text-slate-500">
                {blogCategories.length} categories
              </p>
            </div>
          </div>

          <form onSubmit={submitBlogCategory} className="mt-4 space-y-3">
            <Field label="Name" htmlFor="blog-category-name">
              <input
                id="blog-category-name"
                className={inputClass}
                value={blogCategoryForm.name}
                onChange={(event) =>
                  setBlogCategoryForm((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="e.g. Local news"
                maxLength={100}
                required
                minLength={2}
              />
            </Field>
            <Field label="Description" htmlFor="blog-category-description">
              <input
                id="blog-category-description"
                className={inputClass}
                value={blogCategoryForm.description}
                onChange={(event) =>
                  setBlogCategoryForm((previous) => ({
                    ...previous,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional short description"
                maxLength={500}
              />
            </Field>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy === "blog-category"}
                className={buttonClass("primary", "sm")}
              >
                {busy === "blog-category" ? (
                  <Spinner className="h-3.5 w-3.5" />
                ) : editingBlogCategory ? (
                  <Pencil className="h-3.5 w-3.5" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {editingBlogCategory ? "Save category" : "Add category"}
              </button>
              {editingBlogCategory ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBlogCategory(null);
                    setBlogCategoryForm(emptyBlogCategory);
                  }}
                  className={buttonClass("ghost", "sm")}
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          {blogCategories.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<Tags className="h-5 w-5" />}
                title="No blog categories yet"
                description="Add the first city blog category above."
              />
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-stone-100 border-t border-stone-100">
              {blogCategories.map((category) => (
                <li
                  key={category.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {category.name}
                    </p>
                    <p className="truncate text-xs text-slate-400">
                      /{category.slug}
                      {category.description
                        ? ` · ${category.description}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => editBlogCategory(category)}
                      aria-label={`Edit ${category.name}`}
                      className={buttonClass("ghost", "sm")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeBlogCategory(category)}
                      disabled={busy === `blog-category-${category.id}`}
                      aria-label={`Delete ${category.name}`}
                      className={buttonClass(
                        "ghost",
                        "sm",
                        "text-rose-600 hover:bg-rose-50 hover:text-rose-700",
                      )}
                    >
                      {busy === `blog-category-${category.id}` ? (
                        <Spinner className="h-3.5 w-3.5" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </div>
  );
}
