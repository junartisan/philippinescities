import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, fetchSeoData } from "@/lib/seo";
import type { City } from "@/lib/types";

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
  return `/cities/${slug}`;
}

async function loadCity(slug: string): Promise<City | null> {
  return fetchSeoData<City>(`/api/cities/slug/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const city = await loadCity(slug);
  const path = seoPath(slug);

  if (!city) {
    return buildMetadata({
      title: "City not found",
      description: "Explore cities across the Philippines.",
      path,
    });
  }

  const label = [city.name, city.province].filter(Boolean).join(", ");

  return buildMetadata({
    title: `${label} businesses and city guides`,
    description: `Discover approved businesses, city guides, travel ideas, and community stories from ${label} on Philippines Cities.`,
    path,
    keywords: [city.name, city.province ?? "", city.region ?? "", "city guide"].filter(
      Boolean,
    ),
  });
}

async function CityStructuredData({ params }: MetadataProps) {
  const slug = await resolveSlug(params);
  const city = await loadCity(slug);
  if (!city) return null;

  const path = seoPath(slug);
  const label = [city.name, city.province].filter(Boolean).join(", ");
  const citySchema = {
    "@context": "https://schema.org",
    "@type": "City",
    name: city.name,
    url: absoluteUrl(path),
    containedInPlace: city.province
      ? {
          "@type": "AdministrativeArea",
          name: city.province,
          ...(city.region ? { containedInPlace: { "@type": "AdministrativeArea", name: city.region } } : {}),
        }
      : undefined,
    inLanguage: "en-PH",
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Cities", item: absoluteUrl("/cities") },
      {
        "@type": "ListItem",
        position: 3,
        name: label,
        item: absoluteUrl(path),
      },
    ],
  };

  return <StructuredData data={[citySchema, breadcrumbs]} />;
}

export default function CityDetailLayout({ children, params }: Props) {
  return (
    <>
      <DynamicMarker />
      <Suspense>
        <CityStructuredData params={params} />
      </Suspense>
      {children}
    </>
  );
}
