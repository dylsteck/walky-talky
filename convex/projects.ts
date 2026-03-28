import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .take(100);
  },
});

export const getByV0Id = query({
  args: { v0ProjectId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("projects")
      .withIndex("by_v0ProjectId", (q) => q.eq("v0ProjectId", args.v0ProjectId))
      .unique();
  },
});

export const createFromV0 = internalMutation({
  args: {
    sessionId: v.string(),
    v0ProjectId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("projects")
      .withIndex("by_v0ProjectId", (q) => q.eq("v0ProjectId", args.v0ProjectId))
      .unique();
    if (existing) return existing._id;

    return await ctx.db.insert("projects", {
      sessionId: args.sessionId,
      v0ProjectId: args.v0ProjectId,
      name: args.name,
    });
  },
});
