import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import CategoryClient from "./category-client";

export default function CategoryDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading category…" />}>
        <CategoryClient />
      </Suspense>
    </>
  );
}
