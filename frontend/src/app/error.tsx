"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { buttonClass } from "@/components/ui";

export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
        <TriangleAlert className="h-7 w-7" />
      </span>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">
        An unexpected error interrupted this page. Try again, and if the problem
        continues, check that the API is running.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className={buttonClass("primary", "md", "mt-8")}
      >
        <RotateCcw className="h-4 w-4" />
        Try again
      </button>
    </div>
  );
}
