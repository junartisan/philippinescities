import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Business } from "@/lib/types";
import { Badge, BusinessLogo, Stars } from "@/components/ui";

export function BusinessCard({ business }: { business: Business }) {
  return (
    <Link
      href={`/businesses/${business.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md"
    >
      <div className="flex items-start gap-3.5">
        <BusinessLogo
          name={business.name}
          seed={business.id}
          logoUrl={business.logo_url}
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-slate-900 group-hover:text-emerald-700">
            {business.name}
          </h3>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {business.category.name}
          </p>
          <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {business.city.name}
              {business.city.province ? `, ${business.city.province}` : ""}
            </span>
          </div>
        </div>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-500">
        {business.description || "No description provided yet."}
      </p>
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <Stars
          rating={business.average_rating}
          count={business.review_count}
        />
        <div className="flex items-center gap-1.5">
          {business.is_featured ? <Badge tone="amber">Featured</Badge> : null}
          {business.is_claimed ? (
            <Badge tone="emerald">Claimed</Badge>
          ) : (
            <Badge>Unclaimed</Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
