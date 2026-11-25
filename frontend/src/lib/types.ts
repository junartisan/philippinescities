export type Role = "user" | "owner" | "contributor" | "editor" | "supervisor" | "admin";
export type BusinessStatus = "pending" | "approved" | "rejected";
export type BusinessTeamRole = "corporate_admin" | "branch_manager" | "staff";
export type BusinessInvitationStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "revoked"
  | "expired";
export type BusinessVerificationMethod =
  | "registration"
  | "domain_email"
  | "branch_staff";
export type BusinessVerificationStatus =
  | "unverified"
  | "pending"
  | "verified"
  | "rejected";
export type ArticleAccessOverride = "approved" | "rejected";
export type ClaimStatus = "pending" | "approved" | "rejected";
export type ArticleType =
  | "product_update"
  | "service_update"
  | "promo"
  | "event"
  | "sports"
  | "other";
export type CityPostType = "article" | "event";
export type CityPostReviewStatus = "draft" | "pending" | "approved" | "rejected";
export type BlogContributorStatus = "pending" | "approved" | "rejected";
export type PaymentMethod = "cash" | "bank_transfer";
export type ManualPaymentStatus = "pending" | "approved" | "rejected";
export type FeaturedPaymentMethod = "cash" | "bank_transfer" | "stripe";
export type FeaturedPaymentStatus = "pending" | "paid" | "rejected";
export type FeaturedRequestStatus = "pending" | "approved" | "rejected";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface UserPublic {
  id: number;
  full_name: string;
}

export interface UserBrief extends UserPublic {
  email: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  parent_id: number | null;
  business_count: number;
  child_count: number;
  created_at: string;
  updated_at: string;
}

export interface BlogCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface City {
  id: number;
  name: string;
  slug: string;
  province: string | null;
  region: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessBrief {
  id: number;
  name: string;
  slug: string;
}

export interface Business {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  status: BusinessStatus;
  is_claimed: boolean;
  is_paid: boolean;
  article_access_override: ArticleAccessOverride | null;
  article_access_notes: string | null;
  is_featured: boolean;
  featured_until: string | null;
  rejection_reason: string | null;
  parent_id: number | null;
  hours: string | null;
  promo_headline: string | null;
  promo_details: string | null;
  verification_status: BusinessVerificationStatus;
  verification_method: BusinessVerificationMethod | null;
  lineage: BusinessBrief[];
  branches: BusinessBrief[];
  my_role: BusinessTeamRole | "owner" | null;
  category: Category;
  city: City;
  owner: UserPublic | null;
  average_rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export interface BusinessList {
  items: Business[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface BusinessCsvImportOut {
  rows: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface BusinessTeamMember {
  id: number;
  business_id: number;
  user_id: number;
  role: BusinessTeamRole;
  user: UserBrief | null;
  created_at: string;
}

export interface BusinessInvitation {
  id: number;
  business_id: number;
  business: BusinessBrief | null;
  email: string;
  role: BusinessTeamRole;
  status: BusinessInvitationStatus;
  message: string | null;
  expires_at: string;
  created_at: string;
  token: string | null;
}

export interface BusinessVerification {
  id: number;
  business_id: number;
  business: BusinessBrief | null;
  method: BusinessVerificationMethod;
  status: BusinessVerificationStatus;
  reference: string | null;
  document_url: string | null;
  notes: string | null;
  admin_notes: string | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Claim {
  id: number;
  business_id: number;
  user_id: number;
  message: string | null;
  status: ClaimStatus;
  admin_notes: string | null;
  business: BusinessBrief;
  user: UserBrief;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
}

export interface Review {
  id: number;
  business_id: number;
  rating: number;
  comment: string | null;
  user: UserPublic;
  created_at: string;
  updated_at: string;
}

export interface AdminReview extends Review {
  business: BusinessBrief;
}

export interface OAuthProviders {
  google: boolean;
  facebook: boolean;
}

export interface AdminStats {
  users: number;
  businesses: number;
  pending_businesses: number;
  claims: number;
  pending_claims: number;
  pending_manual_payments: number;
  pending_featured_requests: number;
  pending_contributors: number;
  pending_city_posts: number;
  reviews: number;
  categories: number;
  cities: number;
}

export interface ArticleBusiness extends BusinessBrief {
  logo_url: string | null;
  category: Category;
  city: City;
}

export interface Article {
  id: number;
  business_id: number;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  article_type: ArticleType;
  event_starts_at: string | null;
  event_ends_at: string | null;
  is_published: boolean;
  published_at: string;
  business: ArticleBusiness;
  author: UserPublic | null;
  created_at: string;
  updated_at: string;
}

export interface ArticleList {
  items: Article[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ArticlePayload {
  title: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  article_type: ArticleType;
  event_starts_at: string | null;
  event_ends_at: string | null;
}

export interface CityPostBreadcrumb {
  id: number;
  title: string;
  slug: string;
}

export interface CityPostOption {
  id: number;
  title: string;
  slug: string;
  parent_id: number | null;
}

export interface CityPost {
  id: number;
  city_id: number | null;
  blog_category_id: number | null;
  parent_id: number | null;
  title: string;
  slug: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  post_type: CityPostType;
  event_starts_at: string | null;
  event_ends_at: string | null;
  is_published: boolean;
  published_at: string;
  review_status: CityPostReviewStatus;
  review_notes: string | null;
  reviewed_at: string | null;
  city: City | null;
  blog_category: BlogCategory | null;
  author: UserPublic | null;
  reviewed_by: UserPublic | null;
  breadcrumbs?: CityPostBreadcrumb[];
  children?: CityPostBreadcrumb[];
  created_at: string;
  updated_at: string;
}

export interface CityPostList {
  items: CityPost[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface CityPostComment {
  id: number;
  city_post_id: number;
  body: string;
  user: UserPublic;
  created_at: string;
  updated_at: string;
}

export interface CityPostPayload {
  city_id: number | null;
  blog_category_id: number | null;
  parent_id: number | null;
  title: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  post_type: CityPostType;
  event_starts_at: string | null;
  event_ends_at: string | null;
  is_published: boolean;
}

export interface BlogContributorProfile {
  id: number;
  user_id: number;
  status: BlogContributorStatus;
  message: string | null;
  headline: string | null;
  bio: string | null;
  credentials: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  user: UserBrief;
  cities: City[];
  created_at: string;
  updated_at: string;
}

export interface WriterCredential {
  user_id: number;
  full_name: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  credentials: string | null;
  cities: string[];
}

export interface ContributorStatus {
  status: BlogContributorStatus | null;
  message: string | null;
  admin_notes: string | null;
  reviewed_at: string | null;
  can_apply: boolean;
  cities: City[];
}

export interface ContributorPostPayload {
  city_id: number | null;
  blog_category_id: number | null;
  parent_id: number | null;
  title: string;
  summary: string | null;
  body: string;
  cover_image_url: string | null;
  post_type: CityPostType;
  event_starts_at: string | null;
  event_ends_at: string | null;
  submit_for_review: boolean;
}

export interface BillingConfig {
  enabled: boolean;
  plan_name: string;
}

export interface ManualPayment {
  id: number;
  business_id: number;
  user_id: number | null;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  status: ManualPaymentStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  paid_until: string | null;
  business: BusinessBrief;
  user: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface ManualPaymentPayload {
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
}

export interface ManualPaymentDecision {
  paid_until: string | null;
  admin_notes: string | null;
}

export interface SubscriptionApprove {
  paid_until: string | null;
  admin_notes: string | null;
}

export interface SubscriptionDisapprove {
  admin_notes: string | null;
}

export interface BillingStatus {
  business_id: number;
  is_paid: boolean;
  subscription_status: string | null;
  current_period_end: string | null;
  manual_paid_until: string | null;
  article_access_override: ArticleAccessOverride | null;
  article_access_notes: string | null;
  manual_payment_pending: boolean;
  latest_manual_payment: ManualPayment | null;
  stripe_enabled: boolean;
  plan_name: string;
  has_customer: boolean;
}

export interface FeaturedRequest {
  id: number;
  business_id: number;
  user_id: number | null;
  message: string | null;
  payment_method: FeaturedPaymentMethod;
  payment_status: FeaturedPaymentStatus;
  payment_reference: string | null;
  payment_notes: string | null;
  status: FeaturedRequestStatus;
  admin_notes: string | null;
  reviewed_at: string | null;
  featured_until: string | null;
  business: BusinessBrief & { category: Category; city: City };
  user: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface FeaturedRequestPayload {
  payment_method: FeaturedPaymentMethod;
  message: string | null;
  payment_reference: string | null;
  payment_notes: string | null;
}

export interface FeaturedRequestDecision {
  featured_until: string | null;
  admin_notes: string | null;
}

export interface FeaturedCheckout {
  request: FeaturedRequest;
  checkout_url: string;
}

export interface FeaturedStatus {
  business_id: number;
  is_featured: boolean;
  featured_until: string | null;
  pending_request: FeaturedRequest | null;
  latest_request: FeaturedRequest | null;
  stripe_enabled: boolean;
  plan_name: string;
}

export interface AccountBillingBusiness {
  business: ArticleBusiness;
  article: BillingStatus;
  featured: FeaturedStatus;
  manual_payments: ManualPayment[];
  featured_requests: FeaturedRequest[];
}

export interface AccountBilling {
  has_stripe_customer: boolean;
  article_stripe_enabled: boolean;
  featured_stripe_enabled: boolean;
  article_plan_name: string;
  featured_plan_name: string;
  active_article_subscriptions: number;
  active_featured_listings: number;
  pending_payments: number;
  businesses: AccountBillingBusiness[];
}

export interface BusinessPayload {
  name: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  category_id: number;
  city_id: number;
  parent_id?: number | null;
  hours?: string | null;
  promo_headline?: string | null;
  promo_details?: string | null;
}
