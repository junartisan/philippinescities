import type { BlogContributorStatus, CityPostReviewStatus, CityPostType } from "@/lib/types";

export const CITY_POST_TYPE_LABELS: Record<CityPostType, string> = {
  article: "Article",
  event: "Event",
};

export const CITY_POST_TYPE_OPTIONS = (
  Object.keys(CITY_POST_TYPE_LABELS) as CityPostType[]
).map((value) => ({ value, label: CITY_POST_TYPE_LABELS[value] }));

export const CITY_POST_REVIEW_LABELS: Record<CityPostReviewStatus, string> = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export const CITY_POST_REVIEW_OPTIONS = (
  Object.keys(CITY_POST_REVIEW_LABELS) as CityPostReviewStatus[]
).map((value) => ({ value, label: CITY_POST_REVIEW_LABELS[value] }));

export const CONTRIBUTOR_STATUS_LABELS: Record<BlogContributorStatus, string> = {
  pending: "Pending review",
  approved: "Approved contributor",
  rejected: "Application rejected",
};

export function cityPostTypeTone(value: CityPostType): "emerald" | "violet" {
  return value === "event" ? "violet" : "emerald";
}

export function cityPostReviewTone(
  value: CityPostReviewStatus,
): "stone" | "emerald" | "amber" | "rose" {
  switch (value) {
    case "approved":
      return "emerald";
    case "pending":
      return "amber";
    case "rejected":
      return "rose";
    default:
      return "stone";
  }
}

export function contributorStatusTone(
  value: BlogContributorStatus | null,
): "stone" | "emerald" | "amber" | "rose" {
  switch (value) {
    case "approved":
      return "emerald";
    case "pending":
      return "amber";
    case "rejected":
      return "rose";
    default:
      return "stone";
  }
}
