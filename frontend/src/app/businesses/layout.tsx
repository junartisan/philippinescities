import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Business Directory",
  description:
    "Browse trusted local businesses, hotels, restaurants, services, and shops across cities in the Philippines.",
  path: "/businesses",
  keywords: ["business directory", "local businesses", "Philippines cities"],
});

export default function BusinessesLayout({ children }: { children: ReactNode }) {
  return children;
}
