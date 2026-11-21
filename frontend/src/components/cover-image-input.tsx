"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, Trash2, Upload } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { Alert, buttonClass, Field, Spinner } from "@/components/ui";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export function CoverImageInput({
  value,
  onChange,
  label = "Cover image",
  hint = "JPG, PNG, WebP, or GIF up to 5 MB.",
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_BYTES) {
      setError("Cover image must be 5 MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api<{ url: string }>("/api/uploads/cover-image", {
        method: "POST",
        formData,
      });
      onChange(uploaded.url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <Field label={label} hint={hint}>
      <div className="space-y-3">
        {value ? (
          <div
            role="img"
            aria-label="Cover image preview"
            className="h-40 w-full rounded-xl bg-stone-200 bg-cover bg-center ring-1 ring-black/5"
            style={{ backgroundImage: `url(${value})` }}
          />
        ) : (
          <div className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 text-slate-400">
            <ImageIcon className="h-6 w-6" />
            <span className="text-xs">No cover image selected</span>
          </div>
        )}

        {error ? <Alert>{error}</Alert> : null}

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={buttonClass("secondary", "sm")}
            disabled={uploading}
          >
            {uploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {value ? "Replace image" : "Upload image"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className={buttonClass("ghost", "sm")}
              disabled={uploading}
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </Field>
  );
}
