import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { BlogClient } from "./blog-client";

export default function BlogPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading city blog…" />}>
      <BlogClient />
    </Suspense>
  );
}
