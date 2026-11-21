"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline,
  Undo2,
} from "lucide-react";
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
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition hover:bg-stone-100 hover:text-slate-900"
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
  const [error, setError] = useState("");

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

  return (
    <div>
      <div className="rounded-xl border border-stone-300 bg-white shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-100">
        <div className="flex flex-wrap items-center gap-1 border-b border-stone-200 bg-stone-50 px-2 py-1.5">
          <ToolButton label="Bold" onClick={() => run("bold")}>
            <Bold className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Italic" onClick={() => run("italic")}>
            <Italic className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Underline" onClick={() => run("underline")}>
            <Underline className="h-4 w-4" />
          </ToolButton>
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <ToolButton
            label="Heading 2"
            onClick={() => run("formatBlock", "<h2>")}
          >
            <Heading2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Heading 3"
            onClick={() => run("formatBlock", "<h3>")}
          >
            <Heading3 className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Bulleted list"
            onClick={() => run("insertUnorderedList")}
          >
            <List className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Numbered list"
            onClick={() => run("insertOrderedList")}
          >
            <ListOrdered className="h-4 w-4" />
          </ToolButton>
          <ToolButton
            label="Blockquote"
            onClick={() => run("formatBlock", "<blockquote>")}
          >
            <Quote className="h-4 w-4" />
          </ToolButton>
          <ToolButton label="Insert link" onClick={addLink}>
            <Link2 className="h-4 w-4" />
          </ToolButton>
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
          className="rich-text min-h-[260px] px-4 py-3 text-sm leading-7 text-slate-800 outline-none"
        />
      </div>
      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}
      <p className="mt-1.5 text-xs text-slate-500">
        Use the toolbar for headings, bold text, lists, quotes, and links.
      </p>
    </div>
  );
}
