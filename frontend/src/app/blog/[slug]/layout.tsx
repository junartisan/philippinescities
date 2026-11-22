import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, excerpt, fetchSeoData, plainText } from "@/lib/seo";
import type { CityPost } from "@/lib/types";

type Params = Promise<{ slug: string }> | { slug: string };

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
  return `/blog/${slug}`;
}

async function loadPost(slug: string): Promise<CityPost | null> {
  return fetchSeoData<CityPost>(`/api/city-posts/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const post = await loadPost(slug);
  const path = seoPath(slug);

  if (!post) {
    return buildMetadata({
      title: "City post not found",
      description: "Explore city guides and community stories from the Philippines.",
      path,
    });
  }

  return buildMetadata({
    title: post.title,
    description:
      post.summary || excerpt(post.body, 160) || `${post.title} on Philippines Cities.`,
    path,
    image: post.cover_image_url,
    type: "article",
    publishedTime: post.published_at,
    modifiedTime: post.updated_at,
    section: post.blog_category?.name,
    tags: [post.city.name, post.blog_category?.name, "city blog"].filter(
      (tag): tag is string => Boolean(tag),
    ),
  });
}

async function PostStructuredData({ params }: MetadataProps) {
  const slug = await resolveSlug(params);
  const post = await loadPost(slug);
  if (!post) return null;

  const path = seoPath(slug);
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary || excerpt(post.body, 160) || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    inLanguage: "en-PH",
    author: {
      "@type": "Organization",
      name: post.author?.full_name || "Philippines Cities editorial desk",
    },
    publisher: {
      "@type": "Organization",
      name: "Philippines Cities",
      url: absoluteUrl("/"),
    },
    articleSection: post.blog_category?.name || undefined,
    keywords: [post.city.name, post.blog_category?.name, "city blog"]
      .filter(Boolean)
      .join(", "),
    abstract: post.summary ? plainText(post.summary) : undefined,
    mainEntityOfPage: absoluteUrl(path),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "City Blog", item: absoluteUrl("/blog") },
      { "@type": "ListItem", position: 3, name: post.title, item: absoluteUrl(path) },
    ],
  };

  return <StructuredData data={[schema, breadcrumbs]} />;
}

export default function BlogPostDetailLayout({ children, params }: Props) {
  return (
    <>
      <DynamicMarker />
      <Suspense>
        <PostStructuredData params={params} />
      </Suspense>
      {children}
    </>
  );
}
