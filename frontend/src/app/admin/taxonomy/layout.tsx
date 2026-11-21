"use client";

import type { ReactNode } from "react";
import { RequireAuth } from "@/components/guards";
import type { Role } from "@/lib/types";

const ADMIN_ROLES: Role[] = ["admin"];

export default function AdminOnlyLayout({ children }: { children: ReactNode }) {
  return <RequireAuth roles={ADMIN_ROLES}>{children}</RequireAuth>;
}
