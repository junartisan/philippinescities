"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BusinessForm } from "@/components/business-form";

export default function NewListingPage() {
  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/dashboard/listings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to my listings
        </Link>
        <h2 className="mt-3 text-lg font-semibold text-slate-900">
          Add a business
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Submit the details below. Your listing starts as pending until an admin
          approves it.
        </p>
      </div>
      <BusinessForm />
    </div>
  );
}
