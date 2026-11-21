import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, excerpt, fetchSeoData } from "@/lib/seo";
import type { Business } from "@/lib/types";

type Props = {
  children: ReactNode;
  params: Promise<{ slug: string }>;
};

function seoPath(slug: string): string {
  return `/businesses/${slug}`;
}

async function loadBusiness(slug: string): Promise<Business | null> {
  return fetchSeoData<Business>(
    `/api/businesses/slug/${encodeURIComponent(slug)}`,
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  const path = seoPath(slug);

  if (!business) {
    return buildMetadata({
      title: "Business not found",
      description: "Browse the Philippines Cities business directory.",
      path,
    });
  }

  const location = [business.city.name, business.city.province]
    .filter(Boolean)
    .join(", ");
  return buildMetadata({
    title: `${business.name} in ${location}`,
    description:
      excerpt(business.description, 160) ||
      `${business.name} is listed in ${location}. Find contact details, reviews, and local business information on Philippines Cities.`,
    path,
    image: business.logo_url,
    tags: [business.category.name, business.city.name, "business directory"],
  });
}

export default async function BusinessDetailLayout({
  children,
  params,
}: Props) {
  const { slug } = await params;
  const business = await loadBusiness(slug);
  if (!business) return children;

  const path = seoPath(slug);
  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    url: absoluteUrl(path),
    image: business.logo_url || undefined,
    description: business.description || undefined,
    telephone: business.phone || undefined,
    email: business.email || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address || undefined,
      addressLocality: business.city.name,
      addressRegion: business.city.province || undefined,
      addressCountry: "PH",
    },
    aggregateRating:
      business.review_count > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: business.average_rating,
            reviewCount: business.review_count,
          }
        : undefined,
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "Business Directory",
        item: absoluteUrl("/businesses"),
      },
      { "@type": "ListItem", position: 3, name: business.name, item: absoluteUrl(path) },
    ],
  };

  return (
    <>
      <StructuredData data={[schema, breadcrumbs]} />
      {children}
    </>
  );
}
