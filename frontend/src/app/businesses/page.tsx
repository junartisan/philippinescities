import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { DirectoryClient } from "./directory-client";

export const metadata: Metadata = {
  title: "Business directory",
  description:
    "Search Philippine businesses by category and city, then read reviews from registered users.",
};

export default function BusinessesPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading directory…" />}>
      <DirectoryClient />
    </Suspense>
  );
}
