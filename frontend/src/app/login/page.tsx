import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading sign in…" />}>
      <LoginForm />
    </Suspense>
  );
}
