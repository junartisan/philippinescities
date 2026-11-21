"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export function AdsenseScript() {
  if (!ADSENSE_CLIENT) return null;

  return (
    <Script
      id="google-adsense"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

interface AdSlotProps {
  slot?: string;
  className?: string;
  format?: "auto" | "rectangle" | "horizontal" | "vertical";
  minHeight?: number;
  label?: string;
}

export function AdSlot({
  slot,
  className,
  format = "auto",
  minHeight = 120,
  label = "Advertisement",
}: AdSlotProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const adSlot = slot?.trim();

  useEffect(() => {
    if (!ADSENSE_CLIENT || !adSlot) return;
    const container = containerRef.current;
    if (!container || container.dataset.pushed === "true") return;

    try {
      window.adsbygoogle = window.adsbygoogle ?? [];
      window.adsbygoogle.push({});
      container.dataset.pushed = "true";
    } catch {
      container.dataset.pushed = "error";
    }
  }, [adSlot]);

  if (!ADSENSE_CLIENT || !adSlot) return null;

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden rounded-2xl border border-dashed border-stone-200 bg-white px-2 py-3",
        className,
      )}
    >
      <span className="mb-1 block text-center text-[10px] font-medium uppercase tracking-widest text-stone-400">
        {label}
      </span>
      <ins
        className="adsbygoogle block"
        style={{ display: "block", minHeight }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
