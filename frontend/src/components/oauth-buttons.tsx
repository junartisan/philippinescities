"use client";

import { useEffect, useState } from "react";
import { API_URL, api } from "@/lib/api";
import { buttonClass } from "@/components/ui";
import type { OAuthProviders } from "@/lib/types";

export function OAuthButtons({ next }: { next: string }) {
  const [providers, setProviders] = useState<OAuthProviders | null>(null);

  useEffect(() => {
    let active = true;
    api<OAuthProviders>("/api/auth/oauth/providers", { auth: false })
      .then((data) => {
        if (active) setProviders(data);
      })
      .catch(() => {
        if (active) setProviders({ google: false, facebook: false });
      });
    return () => {
      active = false;
    };
  }, []);

  if (!providers || (!providers.google && !providers.facebook)) return null;

  const nextParam = encodeURIComponent(next);

  return (
    <div className="mt-6">
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-stone-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-white px-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Or continue with
          </span>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {providers.google ? (
          <a
            href={`${API_URL}/api/auth/oauth/google/start?next=${nextParam}`}
            className={buttonClass("secondary", "md", "w-full")}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border border-stone-300 text-[11px] font-bold text-slate-700"
              aria-hidden="true"
            >
              G
            </span>
            Google
          </a>
        ) : null}
        {providers.facebook ? (
          <a
            href={`${API_URL}/api/auth/oauth/facebook/start?next=${nextParam}`}
            className={buttonClass("secondary", "md", "w-full")}
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2] text-[13px] font-bold text-white"
              aria-hidden="true"
            >
              f
            </span>
            Facebook
          </a>
        ) : null}
      </div>
    </div>
  );
}
