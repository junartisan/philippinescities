import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Business Update",
  description:
    "Discover business updates, product news, promotions, and event articles from local businesses across the Philippines.",
  path: "/articles",
  keywords: ["local articles", "business news", "promotions", "Philippines"],
});

export default function ArticlesLayout({ children }: { children: ReactNode }) {
  return children;
}
