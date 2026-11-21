import type { Metadata } from "next";
import { Suspense } from "react";
import { PageLoader } from "@/components/ui";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = {
  title: "Create an account",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading sign up…" />}>
      <RegisterForm />
    </Suspense>
  );
}
