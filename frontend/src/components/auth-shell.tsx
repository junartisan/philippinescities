import Link from "next/link";
import { CheckCircle2, MapPin } from "lucide-react";
import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center">
      <div className="relative hidden overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 p-10 text-white lg:block">
        <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber-300/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full bg-teal-300/10 blur-3xl" />
        <div className="relative">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
              <MapPin className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold">Philippines Cities</span>
          </Link>
          <h2 className="mt-20 max-w-sm text-3xl font-semibold leading-tight tracking-tight">
            Every local business, one trusted place.
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-emerald-100/90">
            Search by category and city, leave reviews, and keep your own
            business listing accurate and easy to find.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-emerald-50">
            {[
              "Browse approved businesses across the Philippines",
              "Claim and manage your own listing",
              "Share reviews as a registered user",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="w-full max-w-md justify-self-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
        {footer ? <div className="mt-6 text-sm text-slate-500">{footer}</div> : null}
      </div>
    </div>
  );
}
