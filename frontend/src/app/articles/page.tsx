import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ArticlesClient } from "./articles-client";

export const metadata: Metadata = {
  title: "Business updates",
  description:
    "Product updates, service changes, promos, and events from paid Philippine business listings.",
};

export default function ArticlesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading updates…" />}>
      <ArticlesClient />
    </Suspense>
  );
}
