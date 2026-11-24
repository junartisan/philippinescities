"use client";

import dynamic from "next/dynamic";

const TinyMCEEditor = dynamic(() => import("./tinymce-editor"), {
  ssr: false,
  loading: () => (
    <div className="h-72 w-full animate-pulse rounded-xl border border-stone-200 bg-stone-50" />
  ),
});

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  return (
    <TinyMCEEditor
      value={value}
      onChange={onChange}
      placeholder={placeholder}
    />
  );
}
