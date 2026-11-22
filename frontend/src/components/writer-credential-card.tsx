"use client";

import { useEffect, useState } from "react";
import { Award, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { Avatar, Spinner } from "@/components/ui";
import type { WriterCredential } from "@/lib/types";

export function WriterCredentialCard({
  userId,
  name,
}: {
  userId: number;
  name: string;
}) {
  const [credential, setCredential] = useState<WriterCredential | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<WriterCredential>(`/api/contributor/writers/${userId}`)
      .then((data) => {
        if (active) setCredential(data);
      })
      .catch(() => {
        if (active) setCredential(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Award className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-900">Writer credential</h2>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Spinner className="h-4 w-4 text-emerald-600" />
          Loading credential…
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <Avatar
              name={credential?.full_name ?? name}
              seed={userId}
              url={credential?.avatar_url ?? undefined}
              size="sm"
            />
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {credential?.full_name ?? name}
              </p>
              <p className="text-xs text-slate-500">
                {credential?.headline ?? "City blog author"}
              </p>
            </div>
          </div>

          {credential?.credentials ? (
            <p className="mt-3 whitespace-pre-line text-xs leading-5 text-emerald-800">
              {credential.credentials}
            </p>
          ) : null}
          {credential?.bio ? (
            <p className="mt-3 text-sm leading-6 text-slate-600">{credential.bio}</p>
          ) : null}
          {credential && credential.cities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {credential.cities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs text-slate-600"
                >
                  <MapPin className="h-3 w-3 text-emerald-600" />
                  {city}
                </span>
              ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
