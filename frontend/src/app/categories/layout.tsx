import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Business Categories",
  description:
    "Explore business categories in the Philippines, from restaurants and hotels to health services and home providers.",
  path: "/categories",
  keywords: ["business categories", "Philippines directory"],
});

export default function CategoriesLayout({ children }: { children: ReactNode }) {
  return children;
}
