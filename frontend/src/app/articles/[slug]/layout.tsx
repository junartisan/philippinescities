import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { StructuredData } from "@/components/structured-data";
import { absoluteUrl, buildMetadata, excerpt, fetchSeoData, plainText } from "@/lib/seo";
import type { Article } from "@/lib/types";

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
  return `/articles/${slug}`;
}

async function loadArticle(slug: string): Promise<Article | null> {
  return fetchSeoData<Article>(`/api/articles/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: MetadataProps): Promise<Metadata> {
  const slug = await resolveSlug(params);
  const article = await loadArticle(slug);
  const path = seoPath(slug);

  if (!article) {
    return buildMetadata({
      title: "Article not found",
      description: "Explore business news, promotions, and event articles from the Philippines.",
      path,
    });
  }

  return buildMetadata({
    title: article.title,
    description:
      article.summary ||
      excerpt(article.body, 160) ||
      `${article.title} on Philippines Cities.`,
    path,
    image: article.cover_image_url,
    type: "article",
    publishedTime: article.published_at,
    modifiedTime: article.updated_at,
    section: article.business.city.name,
    tags: [article.business.name, article.business.city.name, "local business"],
  });
}

async function ArticleStructuredData({ params }: MetadataProps) {
  const slug = await resolveSlug(params);
  const article = await loadArticle(slug);
  if (!article) return null;

  const path = seoPath(slug);
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary || excerpt(article.body, 160) || undefined,
    image: article.cover_image_url || undefined,
    datePublished: article.published_at,
    dateModified: article.updated_at,
    inLanguage: "en-PH",
    author: {
      "@type": "Organization",
      name: article.author?.full_name || article.business.name,
    },
    publisher: {
      "@type": "Organization",
      name: "Philippines Cities",
      url: absoluteUrl("/"),
    },
    articleSection: article.business.city.name,
    keywords: [article.business.name, article.business.city.name, "local business"]
      .filter(Boolean)
      .join(", "),
    abstract: article.summary ? plainText(article.summary) : undefined,
    mainEntityOfPage: absoluteUrl(path),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Articles", item: absoluteUrl("/articles") },
      { "@type": "ListItem", position: 3, name: article.title, item: absoluteUrl(path) },
    ],
  };

  return <StructuredData data={[schema, breadcrumbs]} />;
}

export default function ArticleDetailLayout({ children, params }: Props) {
  return (
    <>
      <DynamicMarker />
      <Suspense>
        <ArticleStructuredData params={params} />
      </Suspense>
      {children}
    </>
  );
}
