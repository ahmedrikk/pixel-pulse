import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useScrollDepth } from "./useScrollDepth";

describe("useScrollDepth", () => {
  it("registers IntersectionObserver on mount", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", vi.fn(() => ({ observe, disconnect })));

    renderHook(() => useScrollDepth("test-page", vi.fn()));
    expect(IntersectionObserver).toHaveBeenCalled();
  });

  it("disconnects observer on unmount", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", vi.fn(() => ({ observe, disconnect })));

    const { unmount } = renderHook(() => useScrollDepth("test-page", vi.fn()));
    unmount();
    expect(disconnect).toHaveBeenCalled();
  });
});
