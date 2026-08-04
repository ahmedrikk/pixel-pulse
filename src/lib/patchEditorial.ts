import type { Json } from "@/integrations/supabase/types";

export interface PatchEditorialSection {
  heading: string;
  body: string;
}

export interface PatchEditorialCallout {
  label: string;
  body: string;
}

export interface PatchEditorialContent {
  opening: string;
  sections: PatchEditorialSection[];
  callouts: PatchEditorialCallout[];
  takeaway: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalisePatchEditorial(value: Json): PatchEditorialContent | null {
  if (!isRecord(value)) return null;
  const opening = readText(value.opening);
  const takeaway = readText(value.takeaway);
  if (!opening || !takeaway || !Array.isArray(value.sections) || !Array.isArray(value.callouts)) return null;

  const sections = value.sections.flatMap((item) => {
    if (!isRecord(item)) return [];
    const heading = readText(item.heading);
    const body = readText(item.body);
    return heading && body ? [{ heading, body }] : [];
  });
  const callouts = value.callouts.flatMap((item) => {
    if (!isRecord(item)) return [];
    const label = readText(item.label);
    const body = readText(item.body);
    return label && body ? [{ label, body }] : [];
  });

  if (sections.length < 2 || callouts.length < 1) return null;
  return { opening, sections, callouts, takeaway };
}
