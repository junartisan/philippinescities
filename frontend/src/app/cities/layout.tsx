import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Cities",
  description:
    "Browse cities across the Philippines and discover local businesses, city guides, and community stories.",
  path: "/cities",
  keywords: ["Philippines cities", "city directory", "local guides"],
});

export default function CitiesLayout({ children }: { children: ReactNode }) {
  return children;
}
