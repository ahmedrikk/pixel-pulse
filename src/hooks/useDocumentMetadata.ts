import { useEffect } from "react";

interface DocumentMetadata {
  title?: string | null;
  description?: string | null;
  canonicalPath?: string | null;
  image?: string | null;
  type?: "website" | "article";
  robots?: string | null;
}

function ensureMeta(selector: string, attribute: "name" | "property", key: string): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const element = document.createElement("meta");
  element.setAttribute(attribute, key);
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

export function useDocumentMetadata({ title, description, canonicalPath, image, type = "website", robots }: DocumentMetadata) {
  useEffect(() => {
    if (!title && !description && !canonicalPath && !image && !robots) return;
    const previousTitle = document.title;
    const canonicalUrl = canonicalPath ? new URL(canonicalPath, window.location.origin).toString() : window.location.href;
    const imageUrl = new URL(image || "/profile-assets/banners/city.jpg", window.location.origin).toString();
    const elements = [
      ensureMeta('meta[name="description"]', "name", "description"),
      ensureMeta('meta[property="og:title"]', "property", "og:title"),
      ensureMeta('meta[property="og:description"]', "property", "og:description"),
      ensureMeta('meta[property="og:type"]', "property", "og:type"),
      ensureMeta('meta[property="og:url"]', "property", "og:url"),
      ensureMeta('meta[property="og:site_name"]', "property", "og:site_name"),
      ensureMeta('meta[property="og:image"]', "property", "og:image"),
      ensureMeta('meta[name="twitter:title"]', "name", "twitter:title"),
      ensureMeta('meta[name="twitter:description"]', "name", "twitter:description"),
      ensureMeta('meta[name="twitter:image"]', "name", "twitter:image"),
      ensureMeta('meta[name="robots"]', "name", "robots"),
    ];
    const previousContent = elements.map((element) => element.content);
    const canonical = ensureCanonical();
    const previousCanonical = canonical.href;

    if (title) document.title = title;
    if (description) elements[0].content = description;
    elements[1].content = title || document.title;
    elements[2].content = description || elements[0].content;
    elements[3].content = type;
    elements[4].content = canonicalUrl;
    elements[5].content = "Talus";
    elements[6].content = imageUrl;
    elements[7].content = title || document.title;
    elements[8].content = description || elements[0].content;
    elements[9].content = imageUrl;
    elements[10].content = robots || "index, follow, max-image-preview:large";
    if (canonicalPath) canonical.href = canonicalUrl;

    return () => {
      document.title = previousTitle;
      elements.forEach((element, index) => { element.content = previousContent[index]; });
      if (previousCanonical) canonical.href = previousCanonical;
      else canonical.remove();
    };
  }, [canonicalPath, description, image, robots, title, type]);
}
