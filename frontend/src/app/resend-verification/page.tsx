import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { ResendVerificationClient } from "./resend-verification-client";

export const metadata: Metadata = {
  title: "Resend verification",
};

export default function ResendVerificationPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading…" />}>
      <ResendVerificationClient />
    </Suspense>
  );
}
