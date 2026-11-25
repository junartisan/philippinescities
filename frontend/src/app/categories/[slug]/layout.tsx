import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, fetchSeoData } from "@/lib/seo";
import type { Category } from "@/lib/types";

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
  return `/categories/${slug}`;
}

async function loadCategory(slug: string): Promise<Category | null> {
  return fetchSeoData<Category>(
    `/api/categories/slug/${encodeURIComponent(slug)}`,
  );
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const category = await loadCategory(slug);
  const path = seoPath(slug);

  if (!category) {
    return buildMetadata({
      title: "Category not found",
      description: "Browse business categories across the Philippines.",
      path,
    });
  }

  const description =
    category.description ??
    `Browse approved ${category.name.toLowerCase()} businesses across the Philippines.`;

  return buildMetadata({
    title: `${category.name} businesses`,
    description,
    path,
    keywords: [category.name, "business directory"],
  });
}

async function CategoryStructuredData({ params }: MetadataProps) {
  const slug = await resolveSlug(params);
  const category = await loadCategory(slug);
  if (!category) return null;

  const path = seoPath(slug);
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${category.name} businesses`,
    description:
      category.description ??
      `Business listings in the ${category.name} category across the Philippines.`,
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
      {
        "@type": "ListItem",
        position: 2,
        name: "All categories",
        item: absoluteUrl("/categories"),
      },
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

export default function CategoryDetailLayout({ children, params }: Props) {
  return (
    <>
      <DynamicMarker />
      <Suspense>
        <CategoryStructuredData params={params} />
      </Suspense>
      {children}
    </>
  );
}
