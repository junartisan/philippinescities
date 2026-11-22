"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { buttonClass } from "@/components/ui";

export function ShareButtons({
  title,
  path,
  heading = "Share this post",
}: {
  title: string;
  path: string;
  heading?: string;
}) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
    setUrl(siteUrl ? `${siteUrl}${path}` : window.location.href);
  }, [path]);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const shareLinks = url
    ? [
        {
          label: "Facebook",
          href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
        },
        {
          label: "X",
          href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
        },
        {
          label: "LinkedIn",
          href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
        },
      ]
    : [];

  async function copyLink() {
    setError("");
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy the link. Please copy it from the address bar.");
    }
  }

  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Share2 className="h-4 w-4 text-emerald-600" />
        <h2 className="text-sm font-semibold text-slate-900">{heading}</h2>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {shareLinks.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "sm")}
          >
            {link.label}
          </a>
        ))}
        <button
          type="button"
          onClick={copyLink}
          disabled={!url}
          className={buttonClass("ghost", "sm")}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </section>
  );
}
