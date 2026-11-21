"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { RequireAuth } from "@/components/guards";
import { buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Overview", exact: true },
  { href: "/dashboard/listings", label: "My listings" },
  { href: "/dashboard/billing", label: "Billing & payments" },
  { href: "/dashboard/claims", label: "My claims" },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <RequireAuth>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
              Owner workspace
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
              Dashboard
            </h1>
          </div>
          <Link
            href="/dashboard/listings/new"
            className={buttonClass("primary", "sm")}
          >
            <Plus className="h-4 w-4" />
            Add listing
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
                    ? "border-emerald-600 text-emerald-700"
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
