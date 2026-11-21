import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ArticleManager } from "./article-manager";

export default function ListingArticlesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading listing updates…" />}>
      <ArticleManager />
    </Suspense>
  );
}
