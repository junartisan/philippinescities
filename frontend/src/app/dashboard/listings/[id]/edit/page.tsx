"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Store } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { BusinessForm } from "@/components/business-form";
import {
  Alert,
  buttonClass,
  EmptyState,
  PageLoader,
} from "@/components/ui";
import type { Business } from "@/lib/types";

export default function EditListingPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    api<Business>(`/api/businesses/${id}`)
      .then((data) => {
        if (active) {
          setBusiness(data);
          setError("");
        }
      })
      .catch((err) => {
        if (active) setError(errorMessage(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) return <PageLoader label="Loading listing…" />;

  if (error || !business) {
    return (
      <EmptyState
        icon={<Store className="h-5 w-5" />}
        title="Listing unavailable"
        description={
          error || "You do not have permission to edit this listing."
        }
        action={
          <Link
            href="/dashboard/listings"
            className={buttonClass("primary", "sm")}
          >
            Back to my listings
          </Link>
        }
      />
    );
  }

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
          Edit {business.name}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Update your listing details. Changes are saved immediately.
        </p>
      </div>
      {business.status !== "approved" ? (
        <Alert tone="info">
          This listing is currently {business.status}. Owners can keep editing it
          while it is being reviewed.
        </Alert>
      ) : null}
      <BusinessForm business={business} />
    </div>
  );
}
