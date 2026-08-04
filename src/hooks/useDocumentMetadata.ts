import { useEffect } from "react";

interface DocumentMetadata {
  title?: string | null;
  description?: string | null;
  canonicalPath?: string | null;
}

function ensureMetaDescription(): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>('meta[name="description"]');
  if (existing) return existing;
  const element = document.createElement("meta");
  element.name = "description";
  document.head.appendChild(element);
  return element;
}

function ensureCanonical(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (existing) return existing;
  const element = document.createElement("link");
  element.rel = "canonical";
  document.head.appendChild(element);
  return element;
}

export function useDocumentMetadata({ title, description, canonicalPath }: DocumentMetadata) {
  useEffect(() => {
    if (!title && !description && !canonicalPath) return;
    const previousTitle = document.title;
    const meta = ensureMetaDescription();
    const previousDescription = meta.content;
    const canonical = ensureCanonical();
    const previousCanonical = canonical.href;

    if (title) document.title = title;
    if (description) meta.content = description;
    if (canonicalPath) canonical.href = new URL(canonicalPath, window.location.origin).toString();

    return () => {
      document.title = previousTitle;
      meta.content = previousDescription;
      if (previousCanonical) canonical.href = previousCanonical;
      else canonical.remove();
    };
  }, [canonicalPath, description, title]);
}
