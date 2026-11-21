"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { PageLoader } from "@/components/ui";
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
  const allowed = Boolean(user && (!roles || roles.includes(user.role)));

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next = encodeURIComponent(pathname);
      router.replace(`/login?next=${next}`);
      return;
    }
    if (roles && !roles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [loading, user, roles, pathname, router]);

  if (loading) return <PageLoader label="Checking your session…" />;
  if (!allowed) return null;
  return <>{children}</>;
}
