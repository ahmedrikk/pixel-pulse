import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Comment } from "@/types/feed";
import { makeComment } from "@/test/commentFixtures";
import { fetchComments } from "@/lib/comments";
import { EnhancedCommentSection } from "./EnhancedCommentSection";

vi.mock("@/contexts/AuthGateContext", () => ({
  useAuthGate: () => ({ isAuthenticated: false, openAuthModal: vi.fn(), user: null }),
}));
vi.mock("@/lib/comments", () => ({
  fetchComments: vi.fn(), insertComment: vi.fn(), updateComment: vi.fn(),
  softDeleteComment: vi.fn(), toggleCommentVote: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("visible comment conversations", () => {
  it("does not replace a known article count with zero while comments are loading", async () => {
    let complete!: (rows: Comment[]) => void;
    vi.mocked(fetchComments).mockReturnValue(new Promise(resolve => { complete = resolve; }));
    const onCountChange = vi.fn();
    render(<EnhancedCommentSection articleId="article" onCountChange={onCountChange} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading comments");
    expect(screen.queryByText(/No comments yet/)).not.toBeInTheDocument();
    expect(onCountChange).not.toHaveBeenCalled();
    await act(async () => complete([makeComment("root")]));
    expect(screen.getByText("Message root")).toBeVisible();
    expect(onCountChange).toHaveBeenLastCalledWith(1);
  });

  it("shows complete nested conversations and lets the reader hide and restore all replies", async () => {
    vi.mocked(fetchComments).mockResolvedValue([
      makeComment("root"), makeComment("child", { parentCommentId: "root" }),
      makeComment("grandchild", { parentCommentId: "child" }),
      makeComment("deep", { parentCommentId: "grandchild" }),
    ]);
    render(<EnhancedCommentSection articleId="article" />);
    expect(await screen.findByText("Message deep")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Hide 3 replies" }));
    expect(screen.queryByText("Message deep")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show 3 replies" }));
    expect(screen.getByText("Message deep")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Reply", exact: true })).toHaveLength(3);
  });

  it("keeps surviving replies visible when their parent has been deleted", async () => {
    vi.mocked(fetchComments).mockResolvedValue([
      makeComment("root", { deletedAt: "2026-11-09T21:00:00Z" }),
      makeComment("child", { parentCommentId: "root" }),
    ]);
    render(<EnhancedCommentSection articleId="article" />);
    expect(await screen.findByText("Message child")).toBeVisible();
    expect(screen.getByText("[deleted]")).toBeVisible();
    expect(screen.queryByText("Message root")).not.toBeInTheDocument();
  });

  it("picks up incoming replies while open and stops refreshing when collapsed", async () => {
    vi.useFakeTimers();
    vi.mocked(fetchComments).mockResolvedValue([makeComment("root")]);
    render(<EnhancedCommentSection articleId="article" />);
    await act(async () => {});
    vi.mocked(fetchComments).mockResolvedValue([makeComment("root"), makeComment("new", { parentCommentId: "root" })]);
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(screen.getByText("Message new")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Comments (2)" }));
    const requests = vi.mocked(fetchComments).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(fetchComments).toHaveBeenCalledTimes(requests);
  });

  it("ignores an older article response that arrives after switching articles", async () => {
    let completeOld!: (rows: Comment[]) => void;
    vi.mocked(fetchComments).mockImplementation(id => id === "old"
      ? new Promise(resolve => { completeOld = resolve; })
      : Promise.resolve([makeComment("current")]));
    const { rerender } = render(<EnhancedCommentSection articleId="old" />);
    rerender(<EnhancedCommentSection articleId="current" />);
    expect(await screen.findByText("Message current")).toBeVisible();
    await act(async () => completeOld([makeComment("outdated")]));
    expect(screen.queryByText("Message outdated")).not.toBeInTheDocument();
    expect(screen.getByText("Message current")).toBeVisible();
  });
});
