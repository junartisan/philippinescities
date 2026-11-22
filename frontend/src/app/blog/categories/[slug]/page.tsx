import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import BlogCategoryClient from "./blog-category-client";

export default function BlogCategoryDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading category…" />}>
        <BlogCategoryClient />
      </Suspense>
    </>
  );
}
