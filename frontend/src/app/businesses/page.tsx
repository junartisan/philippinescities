import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { DirectoryClient } from "./directory-client";

export default function BusinessesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading directory…" />}>
      <DirectoryClient />
    </Suspense>
  );
}
