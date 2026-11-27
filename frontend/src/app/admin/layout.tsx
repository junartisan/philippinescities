"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/components/auth-provider";
import { RequireAuth } from "@/components/guards";
import {
  isNavLinkActive,
  NavDropdown,
  type NavLink,
} from "@/components/nav-dropdown";
import { hasAnyRole, hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

const MODERATOR_ROLES: Role[] = ["admin", "editor", "supervisor"];
const EDITOR_ROLES: Role[] = ["admin", "editor"];
const ADMIN_ROLES: Role[] = ["admin"];

type AdminLink = NavLink & { roles: Role[] };
type AdminItem = AdminLink | { label: string; links: AdminLink[] };

const allItems: AdminItem[] = [
  {
    href: "/admin",
    label: "Overview",
    exact: true,
    roles: MODERATOR_ROLES,
  },
  {
    label: "Directory",
    links: [
      { href: "/admin/businesses", label: "Listings", roles: MODERATOR_ROLES },
      {
        href: "/admin/taxonomy",
        label: "Categories & cities",
        roles: ADMIN_ROLES,
      },
    ],
  },
  {
    label: "Blog & articles",
    links: [
      { href: "/admin/articles", label: "Articles", roles: EDITOR_ROLES },
      { href: "/admin/blog", label: "City blog", roles: EDITOR_ROLES },
      {
        href: "/admin/contributors",
        label: "Contributors",
        roles: EDITOR_ROLES,
      },
    ],
  },
  {
    href: "/admin/reviews",
    label: "Reviews",
    roles: MODERATOR_ROLES,
  },
  { href: "/admin/claims", label: "Claims", roles: ADMIN_ROLES },
  { href: "/admin/verifications", label: "Verifications", roles: ADMIN_ROLES },
  { href: "/admin/payments", label: "Payments", roles: ADMIN_ROLES },
  { href: "/admin/featured", label: "Featured", roles: ADMIN_ROLES },
  { href: "/admin/users", label: "Users", roles: ADMIN_ROLES },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdmin = hasRole(user, "admin");
  const isEditor = hasRole(user, "editor");
  const canSee = (link: AdminLink) => hasAnyRole(user, link.roles);
  const items = allItems
    .map((item) =>
      "links" in item
        ? { ...item, links: item.links.filter(canSee) }
        : item,
    )
    .filter((item) => ("links" in item ? item.links.length > 0 : canSee(item)));
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

        <nav className="mt-6 flex flex-wrap gap-1 border-b border-stone-200">
          {items.map((item) => {
            if ("links" in item) {
              return (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  links={item.links}
                  triggerClass="-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors"
                  activeClass="border-violet-600 text-violet-700"
                  inactiveClass="border-transparent text-slate-500 hover:text-slate-800"
                  linkClass="px-3 py-2"
                  activeLinkClass="bg-violet-50 text-violet-700"
                  inactiveLinkClass="text-slate-600 hover:bg-stone-100 hover:text-slate-900"
                />
              );
            }
            const active = isNavLinkActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-violet-600 text-violet-700"
                    : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8">{children}</div>
      </div>
    </RequireAuth>
  );
}
