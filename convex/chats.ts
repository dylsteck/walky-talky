import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const listByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_projectId", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .take(100);
  },
});

export const getByV0Id = query({
  args: { v0ChatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_v0ChatId", (q) => q.eq("v0ChatId", args.v0ChatId))
      .unique();
  },
});

export const get = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.chatId);
  },
});

export const upsertFromV0 = internalMutation({
  args: {
    sessionId: v.string(),
    projectId: v.id("projects"),
    v0ChatId: v.string(),
    v0ProjectId: v.string(),
    name: v.optional(v.string()),
    title: v.optional(v.string()),
    demoUrl: v.optional(v.string()),
    v0Url: v.optional(v.string()),
    latestVersionId: v.optional(v.string()),
    latestVersionStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chats")
      .withIndex("by_v0ChatId", (q) => q.eq("v0ChatId", args.v0ChatId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        title: args.title ?? existing.title,
        demoUrl: args.demoUrl ?? existing.demoUrl,
        v0Url: args.v0Url ?? existing.v0Url,
        latestVersionId: args.latestVersionId ?? existing.latestVersionId,
        latestVersionStatus: args.latestVersionStatus ?? existing.latestVersionStatus,
      });
      return existing._id;
    }

    return await ctx.db.insert("chats", {
      sessionId: args.sessionId,
      projectId: args.projectId,
      v0ChatId: args.v0ChatId,
      v0ProjectId: args.v0ProjectId,
      name: args.name,
      title: args.title,
      demoUrl: args.demoUrl,
      v0Url: args.v0Url,
      latestVersionId: args.latestVersionId,
      latestVersionStatus: args.latestVersionStatus,
    });
  },
});

export const rename = mutation({
  args: { chatId: v.id("chats"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { name: args.name });
  },
});

export const remove = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.chatId);
  },
});

export const renameInternal = internalMutation({
  args: { chatId: v.id("chats"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.chatId, { name: args.name });
  },
});

export const removeInternal = internalMutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.chatId);
  },
});
