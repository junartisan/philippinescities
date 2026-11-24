"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { isRichText } from "@/lib/utils";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toEditorHtml(value: string): string {
  if (!value) return "";
  if (isRichText(value)) return value;
  return value
    .split(/\n{2,}/)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
}

function ToolButton({
  label,
  onClick,
  children,
  disabled,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-stone-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write the article or event details...",
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor === document.activeElement) return;
    const next = toEditorHtml(value);
    if (editor.innerHTML !== next) editor.innerHTML = next;
  }, [value]);

  function emitChange() {
    const editor = editorRef.current;
    if (!editor) return;
    const html = editor.innerHTML;
    onChange(html === "<br>" ? "" : html);
  }

  function run(command: string, commandValue?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    emitChange();
  }

  function addLink() {
    const url = window.prompt("Link URL", "https://");
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed) return;
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) {
      setError("Links must start with http://, https://, mailto:, /, or #.");
      return;
    }
    setError("");
    run("createLink", trimmed);
  }

  async function handleImageUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError("");
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploaded = await api<{ url: string }>("/api/uploads/cover-image", {
        method: "POST",
        formData,
      });
      run("insertImage", uploaded.url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploadingImage(false);
    }
  }

  return (
    <div>
      <div className="rounded-xl border border-stone-300 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-stone-50 px-2 py-1.5">
          <ToolButton label="Paragraph" onClick={() => run("formatBlock", "<p>")}>
            <Pilcrow className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Heading 1" onClick={() => run("formatBlock", "<h1>")}>
            <Heading1 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Heading 2" onClick={() => run("formatBlock", "<h2>")}>
            <Heading2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Heading 3" onClick={() => run("formatBlock", "<h3>")}>
            <Heading3 className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton label="Bold" onClick={() => run("bold")}>
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => run("italic")}>
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Underline" onClick={() => run("underline")}>
            <Underline className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Strikethrough" onClick={() => run("strikeThrough")}>
            <Strikethrough className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton label="Bulleted list" onClick={() => run("insertUnorderedList")}>
            <List className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Numbered list" onClick={() => run("insertOrderedList")}>
            <ListOrdered className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Blockquote" onClick={() => run("formatBlock", "<blockquote>")}>
            <Quote className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Code block" onClick={() => run("formatBlock", "<pre>")}>
            <Code2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Horizontal rule" onClick={() => run("insertHorizontalRule")}>
            <Minus className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton label="Align left" onClick={() => run("justifyLeft")}>
            <AlignLeft className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Align center" onClick={() => run("justifyCenter")}>
            <AlignCenter className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Align right" onClick={() => run("justifyRight")}>
            <AlignRight className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton label="Insert link" onClick={addLink}>
            <Link2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Remove link" onClick={() => run("unlink")}>
            <Unlink className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label={uploadingImage ? "Uploading image..." : "Insert image"}
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
          >
            <ImagePlus className="h-4 w-4" />
          </ToolButton>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleImageUpload}
          />
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton label="Clear formatting" onClick={() => run("removeFormat")}>
            <Eraser className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Undo" onClick={() => run("undo")}>
            <Undo2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Redo" onClick={() => run("redo")}>
            <Redo2 className="h-4 w-4" />
          </ToolButton>
        </div>
        <div
          ref={editorRef}
          contentEditable
          role="textbox"
          aria-multiline="true"
          aria-label="Article body"
          data-placeholder={placeholder}
          onInput={emitChange}
          onBlur={emitChange}
          className="rich-text min-h-[320px] px-4 py-3 text-sm leading-7 text-slate-800 outline-none"
        />
      </div>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
      <p className="mt-1.5 text-xs text-slate-500">
        {uploadingImage ? "Uploading image..." : "WordPress-style toolbar: headings, formatting, lists, quotes, alignment, links, images, and undo/redo."}
      </p>
    </div>
  );
}
