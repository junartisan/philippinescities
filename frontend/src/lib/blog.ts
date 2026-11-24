import type {
  BlogContributorStatus,
  CityPostOption,
  CityPostReviewStatus,
  CityPostType,
} from "@/lib/types";

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

export function parentPostOptions(
  options: CityPostOption[],
  postId?: number,
): CityPostOption[] {
  const excluded = new Set<number>();
  if (postId) {
    excluded.add(postId);
    for (let pass = 0; pass < options.length + 1; pass += 1) {
      let changed = false;
      for (const option of options) {
        if (option.parent_id && excluded.has(option.parent_id) && !excluded.has(option.id)) {
          excluded.add(option.id);
          changed = true;
        }
      }
      if (!changed) break;
    }
  }

  return options
    .filter((option) => !excluded.has(option.id))
    .map((option) => {
      let depth = 0;
      let parentId = option.parent_id;
      const seen = new Set<number>([option.id]);
      while (parentId && depth < 8 && !seen.has(parentId)) {
        depth += 1;
        seen.add(parentId);
        parentId = options.find((candidate) => candidate.id === parentId)?.parent_id ?? null;
      }
      return { ...option, title: `${"— ".repeat(depth)}${option.title}` };
    });
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
