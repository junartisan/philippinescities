"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/guards";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const MODERATOR_ROLES: Role[] = ["admin", "editor", "supervisor"];
const EDITOR_ROLES: Role[] = ["admin", "editor"];

const allTabs = [
  {
    href: "/admin",
    label: "Overview",
    exact: true,
    roles: MODERATOR_ROLES,
  },
  {
    href: "/admin/businesses",
    label: "Listings",
    roles: MODERATOR_ROLES,
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    roles: MODERATOR_ROLES,
  },
  { href: "/admin/articles", label: "Articles", roles: EDITOR_ROLES },
  { href: "/admin/blog", label: "City blog", roles: EDITOR_ROLES },
  {
    href: "/admin/contributors",
    label: "Contributors",
    roles: EDITOR_ROLES,
  },
  { href: "/admin/claims", label: "Claims", roles: ["admin"] as Role[] },
  { href: "/admin/payments", label: "Payments", roles: ["admin"] as Role[] },
  { href: "/admin/featured", label: "Featured", roles: ["admin"] as Role[] },
  { href: "/admin/users", label: "Users", roles: ["admin"] as Role[] },
  {
    href: "/admin/taxonomy",
    label: "Categories & cities",
    roles: ["admin"] as Role[],
  },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const isEditor = user?.role === "editor";
  const tabs = allTabs.filter((tab) => Boolean(user && tab.roles.includes(user.role)));
  const consoleLabel = isAdmin
    ? "Admin console"
    : isEditor
      ? "Editor console"
      : "Supervisor console";
  const consoleTitle = isAdmin
    ? "Directory moderation"
    : isEditor
      ? "Content moderation"
      : "Moderation queue";

  return (
    <RequireAuth roles={MODERATOR_ROLES}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">
              {consoleLabel}
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              {consoleTitle}
            </h1>
          </div>
          <Link
            href="/businesses"
            className="text-sm font-semibold text-emerald-700 hover:text-emerald-800"
          >
            View public directory
          </Link>
        </div>

        <nav className="mt-6 flex gap-1 overflow-x-auto border-b border-stone-200">
          {tabs.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </RequireAuth>
  );
}
