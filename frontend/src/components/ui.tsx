import type { ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Star,
} from "lucide-react";
import { cn, formatRating, initials } from "@/lib/utils";
import type { BusinessStatus, ClaimStatus } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function buttonClass(
  variant: Variant = "primary",
  size: Size = "md",
  extra?: string,
): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";
  const sizes: Record<Size, string> = {
    sm: "px-3.5 py-2 text-xs",
    md: "px-5 py-2.5 text-sm",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
    secondary:
      "border border-stone-300 bg-white text-slate-700 shadow-sm hover:border-emerald-300 hover:text-emerald-700",
    ghost: "text-slate-600 hover:bg-stone-100 hover:text-slate-900",
    danger: "bg-rose-600 text-white shadow-sm hover:bg-rose-700",
  };
  return cn(base, sizes[size], variants[variant], extra);
}

export const inputClass =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-stone-100";

export const selectClass = inputClass;

export const textareaClass = cn(inputClass, "min-h-[110px] resize-y");

export const labelClass = "mb-1.5 block text-sm font-medium text-slate-700";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const accents = [
  { gradient: "from-emerald-500 to-teal-600", tile: "bg-emerald-100 text-emerald-700" },
  { gradient: "from-amber-500 to-orange-600", tile: "bg-amber-100 text-amber-700" },
  { gradient: "from-sky-500 to-blue-600", tile: "bg-sky-100 text-sky-700" },
  { gradient: "from-rose-500 to-pink-600", tile: "bg-rose-100 text-rose-700" },
  { gradient: "from-violet-500 to-purple-600", tile: "bg-violet-100 text-violet-700" },
  { gradient: "from-orange-500 to-red-600", tile: "bg-orange-100 text-orange-700" },
  { gradient: "from-teal-500 to-cyan-600", tile: "bg-teal-100 text-teal-700" },
  { gradient: "from-indigo-500 to-blue-700", tile: "bg-indigo-100 text-indigo-700" },
  { gradient: "from-cyan-500 to-sky-600", tile: "bg-cyan-100 text-cyan-700" },
  { gradient: "from-fuchsia-500 to-pink-600", tile: "bg-fuchsia-100 text-fuchsia-700" },
  { gradient: "from-lime-500 to-emerald-600", tile: "bg-lime-100 text-lime-700" },
  { gradient: "from-slate-500 to-slate-700", tile: "bg-slate-100 text-slate-700" },
];

export function accentFor(seed: number) {
  return accents[Math.abs(seed) % accents.length];
}

export function Badge({
  children,
  tone = "stone",
}: {
  children: ReactNode;
  tone?: "stone" | "emerald" | "amber" | "rose" | "sky" | "violet";
}) {
  const tones = {
    stone: "bg-stone-100 text-slate-600 ring-stone-200",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
    violet: "bg-violet-50 text-violet-700 ring-violet-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status: BusinessStatus | ClaimStatus;
}) {
  const tone = status === "approved" ? "emerald" : status === "rejected" ? "rose" : "amber";
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  return <Badge tone={tone}>{label}</Badge>;
}

const avatarSizes = {
  sm: "h-10 w-10 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-20 w-20 text-xl",
};

export function Avatar({
  name,
  seed = 0,
  size = "md",
  url,
  className,
}: {
  name: string;
  seed?: number;
  size?: keyof typeof avatarSizes;
  url?: string | null;
  className?: string;
}) {
  const accent = accentFor(seed);
  if (url) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "inline-block shrink-0 rounded-full bg-stone-200 bg-cover bg-center ring-1 ring-black/5",
          avatarSizes[size],
          className,
        )}
        style={{ backgroundImage: `url(${url})` }}
      />
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-1 ring-black/5",
        accent.gradient,
        avatarSizes[size],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

const logoBoxSizes = {
  sm: "h-11 w-11 rounded-xl text-sm",
  md: "h-14 w-14 rounded-2xl text-lg",
  lg: "h-20 w-20 rounded-2xl text-2xl",
};

export function BusinessLogo({
  name,
  seed,
  logoUrl,
  size = "md",
}: {
  name: string;
  seed: number;
  logoUrl?: string | null;
  size?: keyof typeof logoBoxSizes;
}) {
  const accent = accentFor(seed);
  if (logoUrl) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cn(
          "shrink-0 bg-stone-200 bg-cover bg-center ring-1 ring-black/5",
          logoBoxSizes[size],
        )}
        style={{ backgroundImage: `url(${logoUrl})` }}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center bg-gradient-to-br font-semibold text-white ring-1 ring-black/5",
        accent.gradient,
        logoBoxSizes[size],
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Stars({
  rating,
  count,
  className,
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  const filled = Math.round(rating);
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((value) => (
          <Star
            key={value}
            className={cn(
              "h-3.5 w-3.5",
              value <= filled
                ? "fill-amber-400 text-amber-400"
                : "text-stone-300",
            )}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-xs font-medium text-slate-600">
        {formatRating(rating)}
      </span>
      {typeof count === "number" ? (
        <span className="text-xs text-slate-400">({count})</span>
      ) : null}
    </div>
  );
}

export function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
          className="rounded-md p-0.5"
        >
          <Star
            className={cn(
              "h-7 w-7 transition",
              rating <= value
                ? "fill-amber-400 text-amber-400"
                : "text-stone-300 hover:text-amber-300",
            )}
          />
        </button>
      ))}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin", className)} />;
}

export function PageLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-6 w-6 text-emerald-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function Alert({
  tone = "error",
  children,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: ReactNode;
}) {
  const tones = {
    error: "border-rose-200 bg-rose-50 text-rose-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <div className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-14 text-center">
      {icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-t border-stone-200 pt-6">
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </button>
      <p className="text-sm text-slate-500">
        Page {page} of {pages}
      </p>
      <button
        type="button"
        className={buttonClass("secondary", "sm")}
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
      >
        Next
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex gap-4">
        <div className="h-14 w-14 rounded-2xl bg-stone-200" />
        <div className="flex-1 space-y-3">
          <div className="h-4 w-2/3 rounded bg-stone-200" />
          <div className="h-3 w-1/2 rounded bg-stone-200" />
          <div className="h-3 w-full rounded bg-stone-100" />
        </div>
      </div>
    </div>
  );
}
