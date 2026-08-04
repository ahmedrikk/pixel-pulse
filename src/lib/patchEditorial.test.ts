import { describe, expect, it } from "vitest";
import { normalisePatchEditorial } from "@/lib/patchEditorial";

describe("normalisePatchEditorial", () => {
  it("keeps a complete structured patch article", () => {
    expect(normalisePatchEditorial({
      opening: "A grounded opening.",
      sections: [
        { heading: "Combat changes", body: "The first section." },
        { heading: "Map fixes", body: "The second section." },
      ],
      callouts: [{ label: "Try this", body: "A practical recommendation." }],
      takeaway: "A measured closing takeaway.",
    })).toEqual({
      opening: "A grounded opening.",
      sections: [
        { heading: "Combat changes", body: "The first section." },
        { heading: "Map fixes", body: "The second section." },
      ],
      callouts: [{ label: "Try this", body: "A practical recommendation." }],
      takeaway: "A measured closing takeaway.",
    });
  });

  it("rejects incomplete display content instead of falling back to source notes", () => {
    expect(normalisePatchEditorial({
      opening: "Only an opening.",
      sections: [],
      callouts: [],
      takeaway: "No useful structure.",
    })).toBeNull();
  });
});
