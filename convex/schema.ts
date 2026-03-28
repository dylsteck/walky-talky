import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sessions: defineTable({
    sessionId: v.string(),
  }).index("by_sessionId", ["sessionId"]),

  projects: defineTable({
    sessionId: v.string(),
    v0ProjectId: v.string(),
    name: v.string(),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_v0ProjectId", ["v0ProjectId"]),

  chats: defineTable({
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
  })
    .index("by_projectId", ["projectId"])
    .index("by_v0ChatId", ["v0ChatId"])
    .index("by_sessionId", ["sessionId"]),

  generationLimits: defineTable({
    sessionId: v.string(),
    windowStart: v.number(),
    count: v.number(),
  }).index("by_sessionId", ["sessionId"]),
});
