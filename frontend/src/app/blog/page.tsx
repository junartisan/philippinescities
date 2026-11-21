import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { BlogClient } from "./blog-client";

export const metadata: Metadata = {
  title: "City blog",
  description:
    "Articles and events published by Philippines Cities for cities across the Philippines.",
};

export default function BlogPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading city blog…" />}>
      <BlogClient />
    </Suspense>
  );
}
