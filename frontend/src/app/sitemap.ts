import type { MetadataRoute } from "next";
import { API_URL } from "@/lib/api";
import { SITE_URL } from "@/lib/seo";
import type { Article, BlogCategory, Business, Category, City, CityPost } from "@/lib/types";

type Page<T> = { items?: T[] };
type MaybePage<T> = T[] | Page<T>;

async function fetchAll<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = (await res.json()) as MaybePage<T>;
    if (Array.isArray(data)) return data;
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

function entry(path: string, lastModified?: string | Date | null, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", priority = 0.7): MetadataRoute.Sitemap[number] {
  return {
    url: `${SITE_URL}${path}`,
    lastModified: lastModified ? new Date(lastModified) : undefined,
    changeFrequency,
    priority,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [cities, categories, blogCategories, businesses, posts, articles] = await Promise.all([
    fetchAll<City>("/api/cities"),
    fetchAll<Category>("/api/categories"),
    fetchAll<BlogCategory>("/api/blog-categories"),
    fetchAll<Business>("/api/businesses?page=1&page_size=1000"),
    fetchAll<CityPost>("/api/city-posts?page=1&page_size=1000"),
    fetchAll<Article>("/api/articles?page=1&page_size=1000"),
  ]);

  const staticEntries: MetadataRoute.Sitemap = [
    entry("/", undefined, "daily", 1),
    entry("/businesses", undefined, "daily", 0.9),
    entry("/cities", undefined, "weekly", 0.8),
    entry("/categories", undefined, "weekly", 0.8),
    entry("/blog", undefined, "daily", 0.9),
    entry("/articles", undefined, "daily", 0.8),
    entry("/privacy-policy", undefined, "monthly", 0.3),
  ];

  return [
    ...staticEntries,
    ...cities.map((c) => entry(`/cities/${c.slug}`, c.updated_at, "weekly", 0.7)),
    ...categories.map((c) => entry(`/categories/${c.slug}`, c.updated_at, "weekly", 0.7)),
    ...blogCategories.map((c) => entry(`/blog/categories/${c.slug}`, c.updated_at, "weekly", 0.6)),
    ...businesses.filter((b) => b.status === "approved").map((b) => entry(`/businesses/${b.slug}`, b.updated_at, "weekly", 0.8)),
    ...posts.filter((p) => p.is_published).map((p) => entry(`/blog/${p.slug}`, p.updated_at || p.published_at, "weekly", 0.8)),
    ...articles.filter((a) => a.is_published).map((a) => entry(`/articles/${a.slug}`, a.updated_at || a.published_at, "weekly", 0.7)),
  ];
}
