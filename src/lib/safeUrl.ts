export function safeExternalUrl(value: string | null | undefined): string | undefined {
  if (!value || value.length > 2048) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}
