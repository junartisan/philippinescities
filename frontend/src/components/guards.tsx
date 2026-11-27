"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PageLoader } from "@/components/ui";
import { hasAnyRole } from "@/lib/roles";
import type { Role } from "@/lib/types";

export function RequireAuth({
  children,
  roles,
}: {
  children: ReactNode;
  roles?: Role[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const allowed = Boolean(user && (!roles || hasAnyRole(user, roles)));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (roles && !hasAnyRole(user, roles)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, pathname, router]);

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!allowed) return null;
  return <>{children}</>;
}
