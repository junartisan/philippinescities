"use client";

import { Editor, type IAllProps } from "@tinymce/tinymce-react";
import { useId, useMemo } from "react";
import { api } from "@/lib/api";
import { isRichText } from "@/lib/utils";

import "tinymce/tinymce";
import "tinymce/models/dom";
import "tinymce/themes/silver";
import "tinymce/icons/default";
import "tinymce/plugins/advlist";
import "tinymce/plugins/anchor";
import "tinymce/plugins/autolink";
import "tinymce/plugins/autoresize";
import "tinymce/plugins/charmap";
import "tinymce/plugins/code";
import "tinymce/plugins/fullscreen";
import "tinymce/plugins/help";
import "tinymce/plugins/image";
import "tinymce/plugins/insertdatetime";
import "tinymce/plugins/link";
import "tinymce/plugins/lists";
import "tinymce/plugins/media";
import "tinymce/plugins/preview";
import "tinymce/plugins/searchreplace";
import "tinymce/plugins/table";
import "tinymce/plugins/visualblocks";
import "tinymce/plugins/wordcount";
import "tinymce/skins/ui/oxide/skin.min.css";
import "tinymce/skins/content/default/content.min.css";

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const PASTE_ALLOWED_TAGS = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "em",
  "figcaption",
  "figure",
  "h2",
  "h3",
  "h4",
  "hr",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "s",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

const PASTE_REMOVED_TAGS = new Set([
  "area",
  "base",
  "button",
  "canvas",
  "embed",
  "form",
  "head",
  "iframe",
  "input",
  "link",
  "meta",
  "object",
  "script",
  "select",
  "style",
  "svg",
  "textarea",
  "title",
]);

const PASTE_TAG_ALIASES: Record<string, string> = {
  b: "strong",
  i: "em",
  strike: "s",
  del: "s",
};

const PASTE_ALIGN_TAGS = new Set([
  "blockquote",
  "h2",
  "h3",
  "h4",
  "p",
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toEditorHtml(value: string): string {
  if (!value || isRichText(value)) return value;
  return value
    .split(/\n\s*\n/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

function normalizeEditorValue(html: string): string {
  return /^<p>\s*(?:<br[^>]*>)?\s*<\/p>$/i.test(html.trim()) ? "" : html;
}

function isSafeUrl(value: string, allowMailto: boolean): boolean {
  const trimmed = value.trim();
  if (!trimmed || /^(?:javascript|data|vbscript|file):/i.test(trimmed)) return false;
  if (trimmed.startsWith("/") || trimmed.startsWith("#")) return true;
  if (allowMailto && /^mailto:/i.test(trimmed)) return true;
  try {
    const url = new URL(trimmed, "https://philippinescities.com");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function applyStyleWrappers(
  doc: Document,
  source: Element,
  node: Node,
): Node {
  const style = source.getAttribute("style") ?? "";
  let wrapped = node;
  if (/font-weight\s*:\s*(?:bold|[6-9]00)\b/i.test(style)) {
    const strong = doc.createElement("strong");
    strong.appendChild(wrapped);
    wrapped = strong;
  }
  if (/font-style\s*:\s*italic\b/i.test(style)) {
    const em = doc.createElement("em");
    em.appendChild(wrapped);
    wrapped = em;
  }
  if (/text-decoration[^;]*line-through/i.test(style)) {
    const strike = doc.createElement("s");
    strike.appendChild(wrapped);
    wrapped = strike;
  }
  if (/text-decoration[^;]*underline/i.test(style)) {
    const underline = doc.createElement("u");
    underline.appendChild(wrapped);
    wrapped = underline;
  }
  return wrapped;
}

function copyPasteAttributes(source: Element, output: HTMLElement): void {
  const tag = output.tagName.toLowerCase();
  if (tag === "a") {
    const href = source.getAttribute("href");
    const title = source.getAttribute("title");
    if (href && isSafeUrl(href, true)) output.setAttribute("href", href);
    if (title) output.setAttribute("title", title);
    return;
  }
  if (tag === "img") {
    const src = source.getAttribute("src");
    if (src && isSafeUrl(src, false)) {
      output.setAttribute("src", src);
      const alt = source.getAttribute("alt");
      const title = source.getAttribute("title");
      const width = source.getAttribute("width");
      const height = source.getAttribute("height");
      if (alt) output.setAttribute("alt", alt);
      if (title) output.setAttribute("title", title);
      if (width && /^\d{1,4}$/.test(width)) output.setAttribute("width", width);
      if (height && /^\d{1,4}$/.test(height)) output.setAttribute("height", height);
      output.setAttribute("loading", "lazy");
    }
    return;
  }
  if (tag === "td" || tag === "th") {
    const colspan = source.getAttribute("colspan");
    const rowspan = source.getAttribute("rowspan");
    if (colspan && /^\d{1,3}$/.test(colspan)) output.setAttribute("colspan", colspan);
    if (rowspan && /^\d{1,3}$/.test(rowspan)) output.setAttribute("rowspan", rowspan);
    return;
  }
  if (PASTE_ALIGN_TAGS.has(tag)) {
    const align = source
      .getAttribute("style")
      ?.match(/(?:^|;)\s*text-align\s*:\s*(left|center|right|justify)\b/i)?.[1]
      ?.toLowerCase();
    if (align) output.setAttribute("style", `text-align: ${align}`);
  }
}

function cleanPasteNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
    return text ? node.ownerDocument?.createTextNode(text) ?? null : null;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const element = node as Element;
  const doc = element.ownerDocument;
  const rawTag = element.tagName.toLowerCase();
  if (PASTE_REMOVED_TAGS.has(rawTag) || rawTag.startsWith("o:") || rawTag.startsWith("w:") || rawTag.startsWith("v:")) {
    return null;
  }
  if (rawTag === "img") {
    const src = element.getAttribute("src");
    if (!src || !isSafeUrl(src, false)) return null;
  }

  const tag = PASTE_TAG_ALIASES[rawTag] ?? rawTag;
  const children = Array.from(element.childNodes)
    .map(cleanPasteNode)
    .filter((child): child is Node => child !== null);

  if (PASTE_ALLOWED_TAGS.has(tag)) {
    const output = doc.createElement(tag);
    copyPasteAttributes(element, output);
    children.forEach((child) => output.appendChild(child));
    return output;
  }

  const fragment = doc.createDocumentFragment();
  children.forEach((child) => fragment.appendChild(child));
  if (rawTag === "span" || rawTag === "font") {
    return applyStyleWrappers(doc, element, fragment);
  }
  return fragment;
}

function sanitizePastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const container = doc.createElement("div");
  Array.from(doc.body.childNodes).forEach((node) => {
    const cleaned = cleanPasteNode(node);
    if (cleaned) container.appendChild(cleaned);
  });
  return container.innerHTML.trim();
}

function plainTextToHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((block) => `<p>${escapeHtml(block).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
}

const handlePaste: NonNullable<IAllProps["onPaste"]> = (event, editor) => {
  const clipboard = (event as unknown as { clipboardData?: DataTransfer }).clipboardData;
  if (!clipboard || clipboard.files?.length) return;
  const html = clipboard.getData("text/html");
  if (!html) return;
  event.preventDefault();
  const cleaned = sanitizePastedHtml(html);
  const plain = clipboard.getData("text/plain");
  editor.insertContent(cleaned || (plain ? plainTextToHtml(plain) : ""));
};

async function uploadImage(
  blobInfo: { blob: () => Blob; filename: () => string },
  progress: (percent: number) => void,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", blobInfo.blob(), blobInfo.filename());
  const response = await api<{ url: string }>("/api/uploads/cover-image", {
    formData,
  });
  progress(100);
  return response.url;
}

export default function TinyMCEEditor({
  value,
  onChange,
  placeholder,
}: RichTextEditorProps) {
  const editorId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const init = useMemo(
    () => ({
      placeholder: placeholder ?? "",
      branding: false,
      promotion: false,
      skin: false,
      content_css: false,
      menubar: false,
      plugins: [
        "advlist",
        "anchor",
        "autolink",
        "autoresize",
        "charmap",
        "code",
        "fullscreen",
        "help",
        "image",
        "insertdatetime",
        "link",
        "lists",
        "media",
        "preview",
        "searchreplace",
        "table",
        "visualblocks",
        "wordcount",
      ],
      toolbar:
        "undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | link image media table | hr removeformat | code fullscreen",
      block_formats:
        "Paragraph=p;Heading 2=h2;Heading 3=h3;Heading 4=h4;Quote=blockquote;Preformatted=pre",
      autoresize_min_height: 360,
      autoresize_max_height: 720,
      elementpath: false,
      resize: true,
      automatic_uploads: true,
      images_upload_handler: uploadImage,
      file_picker_types: "image" as const,
      content_style:
        "body{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.7;color:#1c1917}img{max-width:100%;height:auto;border-radius:0.75rem}table{border-collapse:collapse;width:100%}td,th{border:1px solid #d6d3d1;padding:0.5rem}",
    }),
    [placeholder],
  );

  return (
    <Editor
      id={editorId}
      licenseKey="gpl"
      value={toEditorHtml(value)}
      onEditorChange={(html) => onChange(normalizeEditorValue(html))}
      init={init}
      onPaste={handlePaste}
    />
  );
}
