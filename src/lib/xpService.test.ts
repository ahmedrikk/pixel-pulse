import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { awarded: 20, xp_today: 20 }, error: null }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

import { trackArticleRead, trackReadMore, claimDailyLogin, trackReaction, trackComment, trackScroll, submitPrediction } from "./xpService";

describe("xpService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("trackArticleRead calls award-xp with read_summary", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const result = await trackArticleRead("https://ign.com/article/1");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "read_summary", ref_id: "https://ign.com/article/1" },
    });
    expect(result?.awarded).toBe(20);
  });

  it("trackReadMore calls award-xp with read_more", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await trackReadMore("https://ign.com/article/1");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "read_more", ref_id: "https://ign.com/article/1" },
    });
  });

  it("claimDailyLogin calls award-xp with daily_login", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await claimDailyLogin();
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "daily_login", ref_id: undefined },
    });
  });

  it("trackReaction calls award-xp with react and url:emoji ref_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await trackReaction("https://ign.com/1", "👍");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "react", ref_id: "https://ign.com/1:👍" },
    });
  });

  it("trackScroll 50% calls scroll_50 with page ref", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await trackScroll("/", 50);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "scroll_50", ref_id: "/" },
    });
  });

  it("submitPrediction inserts prediction then calls predict_submit", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    await submitPrediction(123, "Team A");
    expect(supabase.from).toHaveBeenCalledWith("predictions");
    expect(supabase.functions.invoke).toHaveBeenCalledWith("award-xp", {
      body: { action_type: "predict_submit", ref_id: "123" },
    });
  });
});
