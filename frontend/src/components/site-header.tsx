"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { NavDropdown } from "@/components/nav-dropdown";
import { Avatar, buttonClass } from "@/components/ui";
import { hasAnyRole, hasRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const navGroups = [
  {
    label: "Directory",
    links: [
      { href: "/businesses", label: "All businesses" },
      { href: "/articles", label: "Business Update" },
      { href: "/categories", label: "Categories" },
      { href: "/cities", label: "Cities" },
    ],
  },
];

const topArticlesLink = { href: "/blog", label: "Top Articles" };

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const canAccessAdmin = hasAnyRole(user, ["admin", "editor", "supervisor"]);
  const consoleLabel = hasRole(user, "admin")
    ? "Admin"
    : hasRole(user, "editor")
      ? "Editor"
      : "Moderation";
  const consoleTitle = hasRole(user, "admin")
    ? "Admin console"
    : hasRole(user, "editor")
      ? "Editor console"
      : "Supervisor console";

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function handleLogout() {
    logout();
    setOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5"
          onClick={() => setOpen(false)}
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
            <MapPin className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-base font-semibold tracking-tight text-slate-900">
              Philippines Cities
            </span>
            <span className="hidden text-[11px] text-slate-500 sm:block">
              Philippine business directory
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navGroups.map((group) => (
            <NavDropdown
              key={group.label}
              label={group.label}
              links={group.links}
              triggerClass="rounded-full px-3.5 py-2 text-sm font-medium transition-colors"
              activeClass="bg-emerald-50 text-emerald-700"
              inactiveClass="text-slate-600 hover:bg-stone-100 hover:text-slate-900"
              linkClass="px-3 py-2"
            />
          ))}
          <Link
            href={topArticlesLink.href}
            className={cn(
              "rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
              isActive(topArticlesLink.href)
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-600 hover:bg-stone-100 hover:text-slate-900",
            )}
          >
            {topArticlesLink.label}
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {loading ? (
            <div className="h-9 w-28 animate-pulse rounded-full bg-stone-200" />
          ) : user ? (
            <>
              {canAccessAdmin ? (
                <Link
                  href="/admin"
                  className={buttonClass("ghost", "sm")}
                  title={consoleTitle}
                >
                  <ShieldCheck className="h-4 w-4" />
                  {consoleLabel}
                </Link>
              ) : null}
              <Link
                href="/dashboard/listings/new"
                className={buttonClass("secondary", "sm")}
              >
                <Plus className="h-4 w-4" />
                List business
              </Link>
              <Link
                href="/dashboard"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition hover:bg-stone-100"
              >
                <Avatar name={user.full_name} seed={user.id} size="sm" />
                <span className="max-w-[120px] truncate text-sm font-medium text-slate-700">
                  {user.full_name}
                </span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={buttonClass("ghost", "sm")}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className={buttonClass("ghost", "sm")}>
                Log in
              </Link>
              <Link href="/register" className={buttonClass("primary", "sm")}>
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="rounded-lg p-2 text-slate-600 hover:bg-stone-100 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-stone-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {navGroups.map((group) => (
              <NavDropdown
                key={group.label}
                label={group.label}
                links={group.links}
                variant="inline"
                triggerClass="rounded-xl px-3 py-2.5 text-sm font-medium"
                activeClass="bg-emerald-50 text-emerald-700"
                inactiveClass="text-slate-600 hover:bg-stone-100"
                linkClass="px-3 py-2.5"
                onNavigate={() => setOpen(false)}
              />
            ))}
            <Link
              href={topArticlesLink.href}
              onClick={() => setOpen(false)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-sm font-medium",
                isActive(topArticlesLink.href)
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-slate-600 hover:bg-stone-100",
              )}
            >
              {topArticlesLink.label}
            </Link>
          </nav>
          <div className="mt-4 border-t border-stone-200 pt-4">
            {loading ? null : user ? (
              <div className="space-y-2">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-stone-100"
                >
                  <Avatar name={user.full_name} seed={user.id} size="sm" />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">
                      {user.full_name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Open dashboard
                    </span>
                  </span>
                </Link>
                <Link
                  href="/dashboard/listings/new"
                  onClick={() => setOpen(false)}
                  className={buttonClass("primary", "sm", "w-full")}
                >
                  <Plus className="h-4 w-4" />
                  List a business
                </Link>
                {canAccessAdmin ? (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className={buttonClass("secondary", "sm", "w-full")}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    {consoleTitle}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={handleLogout}
                  className={buttonClass("ghost", "sm", "w-full")}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className={buttonClass("secondary", "sm", "w-full")}
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className={buttonClass("primary", "sm", "w-full")}
                >
                  Create an account
                </Link>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
