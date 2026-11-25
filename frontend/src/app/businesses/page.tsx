import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { buildMetadata, fetchSeoData } from "@/lib/seo";
import type { City } from "@/lib/types";
import { DirectoryClient } from "./directory-client";

type MetadataProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({ searchParams }: MetadataProps): Promise<Metadata> {
  const params = await searchParams;
  const cityId = firstValue(params.city_id);
  const city = cityId
    ? await fetchSeoData<City>(`/api/cities/${encodeURIComponent(cityId)}`)
    : null;
  const title = city ? `Business Directory in ${city.name}` : "Business Directory";
  const description = city
    ? `Browse approved businesses in ${city.name} on Philippines Cities.`
    : "Browse trusted local businesses, hotels, restaurants, services, and shops across cities in the Philippines.";

  return buildMetadata({
    title,
    description,
    path: cityId ? `/businesses?city_id=${encodeURIComponent(cityId)}` : "/businesses",
    keywords: city ? [city.name, city.province ?? "", city.region ?? ""] : [],
  });
}

export default function BusinessesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading directory…" />}>
      <DirectoryClient />
    </Suspense>
  );
}
