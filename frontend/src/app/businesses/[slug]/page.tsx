import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import BusinessClient from "./business-client";

export default function BusinessDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading business…" />}>
        <BusinessClient />
      </Suspense>
    </>
  );
}
