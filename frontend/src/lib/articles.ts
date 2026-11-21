import type { ArticleType } from "@/lib/types";

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  product_update: "Product update",
  service_update: "Service update",
  promo: "Promo",
  event: "Event",
  other: "Update",
};

export const ARTICLE_TYPE_OPTIONS = (
  Object.keys(ARTICLE_TYPE_LABELS) as ArticleType[]
).map((value) => ({ value, label: ARTICLE_TYPE_LABELS[value] }));

export type ArticleTone = "stone" | "emerald" | "amber" | "sky" | "violet";

export function articleTypeTone(value: ArticleType): ArticleTone {
  switch (value) {
    case "product_update":
      return "emerald";
    case "service_update":
      return "sky";
    case "promo":
      return "amber";
    case "event":
      return "violet";
    default:
      return "stone";
  }
}
