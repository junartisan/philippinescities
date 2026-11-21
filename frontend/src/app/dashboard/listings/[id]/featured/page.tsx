import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { FeaturedListingPanel } from "./featured-listing-panel";

export default function FeaturedListingPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading featured listing…" />}>
      <FeaturedListingPanel />
    </Suspense>
  );
}
