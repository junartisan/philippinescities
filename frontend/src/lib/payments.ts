import type {
  FeaturedPaymentMethod,
  FeaturedPaymentStatus,
  FeaturedRequestStatus,
  ManualPaymentStatus,
  PaymentMethod,
} from "@/lib/types";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
};

export const FEATURED_PAYMENT_METHOD_LABELS: Record<
  FeaturedPaymentMethod,
  string
> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  stripe: "Card via Stripe",
};

export const FEATURED_PAYMENT_STATUS_LABELS: Record<
  FeaturedPaymentStatus,
  string
> = {
  pending: "Payment pending",
  paid: "Paid",
  rejected: "Payment rejected",
};

export const FEATURED_REQUEST_STATUS_LABELS: Record<
  FeaturedRequestStatus,
  string
> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

export const MANUAL_PAYMENT_STATUS_LABELS: Record<
  ManualPaymentStatus,
  string
> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export type PaymentTone = "stone" | "emerald" | "amber" | "rose";

export function manualPaymentTone(
  status: ManualPaymentStatus,
): PaymentTone {
  if (status === "approved") return "emerald";
  if (status === "rejected") return "rose";
  return "amber";
}

export function featuredPaymentTone(
  status: FeaturedPaymentStatus,
): PaymentTone {
  if (status === "paid") return "emerald";
  if (status === "rejected") return "rose";
  return "amber";
}

export function featuredRequestTone(
  status: FeaturedRequestStatus,
): PaymentTone {
  if (status === "approved") return "emerald";
  if (status === "rejected") return "rose";
  return "amber";
}
