import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const WINDOW_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_GENERATIONS = 3;

export const checkAndIncrement = internalMutation({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("generationLimits")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (!existing) {
      await ctx.db.insert("generationLimits", {
        sessionId: args.sessionId,
        windowStart: now,
        count: 1,
      });
      return {
        success: true,
        remaining: MAX_GENERATIONS - 1,
        limit: MAX_GENERATIONS,
        resetTime: now + WINDOW_MS,
      };
    }

    // Check if window has expired
    if (now - existing.windowStart >= WINDOW_MS) {
      await ctx.db.patch(existing._id, {
        windowStart: now,
        count: 1,
      });
      return {
        success: true,
        remaining: MAX_GENERATIONS - 1,
        limit: MAX_GENERATIONS,
        resetTime: now + WINDOW_MS,
      };
    }

    // Within window — check count
    if (existing.count >= MAX_GENERATIONS) {
      return {
        success: false,
        remaining: 0,
        limit: MAX_GENERATIONS,
        resetTime: existing.windowStart + WINDOW_MS,
      };
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
    });
    return {
      success: true,
      remaining: MAX_GENERATIONS - (existing.count + 1),
      limit: MAX_GENERATIONS,
      resetTime: existing.windowStart + WINDOW_MS,
    };
  },
});
