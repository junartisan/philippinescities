import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import BlogPostClient from "./blog-post-client";

export default function CityPostDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading post…" />}>
        <BlogPostClient />
      </Suspense>
    </>
  );
}
