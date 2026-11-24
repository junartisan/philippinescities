import Link from "next/link";
import { MapPin } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <MapPin className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold text-slate-900">Philippines Cities</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-500">
            A directory of Philippine businesses, organized by category and city.
            Owners can claim their listing, keep details current, and let
            customers leave reviews.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Explore</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
            <li>
              <Link className="hover:text-emerald-700" href="/businesses">
                All businesses
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/articles">
                Business Update
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/blog">
                City blog
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/categories">
                Categories
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/cities">
                Cities
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">For businesses</h3>
          <ul className="mt-4 space-y-2.5 text-sm text-slate-500">
            <li>
              <Link
                className="hover:text-emerald-700"
                href="/dashboard/listings/new"
              >
                Add a listing
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/dashboard">
                Owner dashboard
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/register">
                Create an account
              </Link>
            </li>
            <li>
              <Link className="hover:text-emerald-700" href="/contributor">
                Write for the city blog
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-stone-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© Philippines Cities. Philippine business directory.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link className="hover:text-emerald-700" href="/privacy-policy">
              Privacy Policy
            </Link>
            <p>Listings and reviews are managed by the community and its admins.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
