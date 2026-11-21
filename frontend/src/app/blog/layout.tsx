import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "City Blog",
  description:
    "Read city guides, local news, travel ideas, food recommendations, and community stories from across the Philippines.",
  path: "/blog",
  keywords: ["city blog", "city guides", "Philippines travel", "local stories"],
});

export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
