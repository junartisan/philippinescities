import Link from "next/link";
import { ArrowLeft, Compass, SearchX } from "lucide-react";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <SearchX className="h-7 w-7" />
      </span>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-emerald-700">
        404
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
        We could not find that page
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        The page may have moved, or the business may no longer be listed. Try
        browsing the directory instead.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className={buttonClass("primary")}>
          <ArrowLeft className="h-4 w-4" />
          Back home
        </Link>
        <Link href="/businesses" className={buttonClass("secondary")}>
          <Compass className="h-4 w-4" />
          Browse businesses
        </Link>
      </div>
    </div>
  );
}
