import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, fetchSeoData } from "@/lib/seo";
import type { BlogCategory } from "@/lib/types";

type Params = Promise<{ slug: string }>;

type MetadataProps = {
  params: Params;
};

type Props = MetadataProps & {
  children: ReactNode;
};

async function resolveSlug(params: Params): Promise<string> {
  const { slug } = await Promise.resolve(params);
  return slug;
}

function seoPath(slug: string): string {
  return `/blog/categories/${slug}`;
}

async function loadBlogCategory(slug: string): Promise<BlogCategory | null> {
  return fetchSeoData<BlogCategory>(
    `/api/blog-categories/slug/${encodeURIComponent(slug)}`,
  );
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const category = await loadBlogCategory(slug);
  const path = seoPath(slug);

  if (!category) {
    return buildMetadata({
      title: "Blog category not found",
      description: "Explore city guides and community stories from the Philippines.",
      path,
    });
  }

  const description =
    category.description ??
    `Read ${category.name.toLowerCase()} stories from cities across the Philippines.`;

  return buildMetadata({
    title: `${category.name} city blog`,
    description,
    path,
    keywords: [category.name, "city blog", "local stories"],
  });
}

async function BlogCategoryStructuredData({ params }: MetadataProps) {
  const slug = await resolveSlug(params);
  const category = await loadBlogCategory(slug);
  if (!category) return null;

  const path = seoPath(slug);
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} city blog`,
    description:
      category.description ??
      `City blog posts in the ${category.name} category from across the Philippines.`,
    url: absoluteUrl(path),
    inLanguage: "en-PH",
    isPartOf: {
      "@type": "WebSite",
      name: "Philippines Cities",
      url: absoluteUrl("/"),
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "City Blog", item: absoluteUrl("/blog") },
      {
        "@type": "ListItem",
        position: 3,
        name: category.name,
        item: absoluteUrl(path),
      },
    ],
  };

  return <StructuredData data={[schema, breadcrumbs]} />;
}

export default function BlogCategoryDetailLayout({ children, params }: Props) {
  return (
    <>
      <DynamicMarker />
      <Suspense>
        <BlogCategoryStructuredData params={params} />
      </Suspense>
      {children}
    </>
  );
}
