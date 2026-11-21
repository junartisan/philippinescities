import type { Metadata } from "next";
import { API_URL } from "@/lib/api";

export const SITE_NAME = "Philippines Cities";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://philippinescities.com"
).replace(/\/$/, "");
export const SITE_DESCRIPTION =
  "Discover local businesses, city guides, travel ideas, and community stories across the Philippines.";

type PageSeo = {
  title: string;
  description: string;
  path: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: string | null;
  modifiedTime?: string | null;
  section?: string;
  tags?: string[];
  keywords?: string[];
};

export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}

function imageUrl(image: string): string {
  return image.startsWith("http://") || image.startsWith("https://")
    ? image
    : absoluteUrl(image);
}

export function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function excerpt(value: string | null | undefined, limit = 160): string {
  const text = plainText(value ?? "");
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return `${lastSpace > 0 ? cut.slice(0, lastSpace) : cut}…`;
}

export function buildMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  publishedTime,
  modifiedTime,
  section,
  tags = [],
  keywords: extraKeywords = [],
}: PageSeo): Metadata {
  const url = absoluteUrl(path);
  const images = image ? [imageUrl(image)] : undefined;
  const keywords = [
    "Philippines",
    "Philippine cities",
    "business directory",
    "city blog",
    "local businesses",
    "travel guides",
    ...tags,
    ...extraKeywords,
  ];

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    applicationName: SITE_NAME,
    referrer: "origin-when-cross-origin",
    keywords,
    authors: [{ name: SITE_NAME, url: SITE_URL }],
    creator: SITE_NAME,
    publisher: SITE_NAME,
    alternates: { canonical: path },
    openGraph: {
      type,
      url,
      siteName: SITE_NAME,
      title,
      description,
      locale: "en_PH",
      images,
      publishedTime: publishedTime ?? undefined,
      modifiedTime: modifiedTime ?? undefined,
      section,
      tags,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
      images,
    },
    robots: {
      index: true,
      follow: true,
      nocache: false,
      googleBot: {
        index: true,
        follow: true,
        noimageindex: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    other: {
      "ai-crawlers": "index, follow",
    },
  };
}

export async function fetchSeoData<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
