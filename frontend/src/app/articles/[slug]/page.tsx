import { Suspense } from "react";
import { DynamicMarker } from "@/components/dynamic-marker";
import { PageLoader } from "@/components/ui";
import ArticleClient from "./article-client";

export default function ArticleDetailPage() {
  return (
    <>
      <DynamicMarker />
      <Suspense fallback={<PageLoader label="Loading update…" />}>
        <ArticleClient />
      </Suspense>
    </>
  );
}
