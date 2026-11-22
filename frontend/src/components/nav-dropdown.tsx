"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavLink = {
  href: string;
  label: string;
  exact?: boolean;
};

export function isNavLinkActive(pathname: string, link: NavLink) {
  return link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function NavDropdown({
  label,
  links,
  variant = "desktop",
  triggerClass,
  activeClass,
  inactiveClass,
  panelClass,
  linkClass,
  activeLinkClass,
  inactiveLinkClass,
  onNavigate,
}: {
  label: string;
  links: NavLink[];
  variant?: "desktop" | "inline";
  triggerClass?: string;
  activeClass?: string;
  inactiveClass?: string;
  panelClass?: string;
  linkClass?: string;
  activeLinkClass?: string;
  inactiveLinkClass?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);
  const active = links.some((link) => isNavLinkActive(pathname, link));

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        ref.current.open = false;
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && ref.current) ref.current.open = false;
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="group relative">
      <summary
        className={cn(
          "inline-flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden",
          active ? activeClass : inactiveClass,
          triggerClass,
        )}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div
        className={cn(
          "z-50 w-56 rounded-xl border border-stone-200 bg-white p-1 shadow-lg",
          variant === "desktop"
            ? "absolute left-0 top-full mt-2"
            : "relative left-0 top-auto ml-3 mt-1 w-auto border-0 bg-transparent p-0 shadow-none",
          panelClass,
        )}
      >
        {links.map((link) => {
          const linkActive = isNavLinkActive(pathname, link);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "block rounded-lg text-sm transition-colors",
                linkClass,
                linkActive
                  ? (activeLinkClass ?? "bg-emerald-50 text-emerald-700")
                  : (inactiveLinkClass ??
                    "text-slate-600 hover:bg-stone-100 hover:text-slate-900"),
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </details>
  );
}
