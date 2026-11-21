import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ArticlesClient } from "./articles-client";

export default function ArticlesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading updates…" />}>
      <ArticlesClient />
    </Suspense>
  );
}
