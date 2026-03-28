"use node";

import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { v0, type ChatDetail } from "v0-sdk";
import { Id } from "./_generated/dataModel";

export const generate = action({
  args: {
    sessionId: v.string(),
    message: v.string(),
    v0ChatId: v.optional(v.string()),
    v0ProjectId: v.optional(v.string()),
    modelId: v.optional(v.string()),
    imageGenerations: v.optional(v.boolean()),
    thinking: v.optional(v.boolean()),
    attachments: v.optional(
      v.array(
        v.object({
          url: v.string(),
          name: v.optional(v.string()),
          type: v.optional(v.string()),
        })
      )
    ),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    // Check rate limit
    const rateLimit = await ctx.runMutation(
      internal.rateLimits.checkAndIncrement,
      { sessionId: args.sessionId }
    );
    if (!rateLimit.success) {
      return {
        error: "RATE_LIMIT_EXCEEDED",
        message: `You've reached the limit of ${rateLimit.limit} generations per 12 hours.`,
        remaining: rateLimit.remaining,
        resetTime: new Date(rateLimit.resetTime).toISOString(),
      };
    }

    const modelId = (args.modelId || "v0-1.5-md") as any;
    const imageGenerations = args.imageGenerations ?? false;
    const thinking = args.thinking ?? false;
    const attachments = args.attachments || [];

    let response: ChatDetail;

    if (args.v0ChatId) {
      response = (await v0.chats.sendMessage({
        chatId: args.v0ChatId,
        message: args.message.trim(),
        modelConfiguration: { modelId, imageGenerations, thinking },
        responseMode: "sync",
        ...(attachments.length > 0 && { attachments }),
      })) as ChatDetail;
    } else {
      response = (await v0.chats.create({
        system:
          'v0 MUST always generate code even if the user just says "hi" or asks a question. v0 MUST NOT ask the user to clarify their request.',
        message: args.message.trim(),
        modelConfiguration: { modelId, imageGenerations, thinking },
        responseMode: "sync",
        ...(args.v0ProjectId && { projectId: args.v0ProjectId }),
        ...(attachments.length > 0 && { attachments }),
      })) as ChatDetail;

      try {
        await v0.chats.update({ chatId: response.id, name: "Main" });
      } catch {
        // Don't fail if rename fails
      }
    }

    const v0ProjectId = (response as any).projectId || args.v0ProjectId;
    let convexProjectId: Id<"projects"> | null = null;

    if (v0ProjectId) {
      try {
        const project = await v0.projects.getById({ projectId: v0ProjectId });
        convexProjectId = await ctx.runMutation(
          internal.projects.createFromV0,
          {
            sessionId: args.sessionId,
            v0ProjectId: v0ProjectId,
            name: project.name || "Untitled Project",
          }
        );
      } catch {
        convexProjectId = await ctx.runMutation(
          internal.projects.createFromV0,
          {
            sessionId: args.sessionId,
            v0ProjectId: v0ProjectId,
            name: "Untitled Project",
          }
        );
      }
    }

    if (convexProjectId) {
      await ctx.runMutation(internal.chats.upsertFromV0, {
        sessionId: args.sessionId,
        projectId: convexProjectId,
        v0ChatId: response.id,
        v0ProjectId: v0ProjectId,
        name: (response as any).name || "Main",
        title: (response as any).title,
        demoUrl: (response as any).demo,
        v0Url: (response as any).url,
        latestVersionId: (response as any).latestVersion?.id,
        latestVersionStatus: (response as any).latestVersion?.status,
      });
    }

    return {
      id: response.id,
      projectId: v0ProjectId,
      demo: (response as any).demo,
      url: (response as any).url,
      name: (response as any).name,
      latestVersion: (response as any).latestVersion,
    };
  },
});

export const createProject = action({
  args: { sessionId: v.string(), name: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const project = await v0.projects.create({ name: args.name.trim() });

    const convexProjectId: Id<"projects"> = await ctx.runMutation(
      internal.projects.createFromV0,
      {
        sessionId: args.sessionId,
        v0ProjectId: project.id,
        name: project.name || args.name.trim(),
      }
    );

    return {
      id: project.id,
      name: project.name,
      convexId: convexProjectId,
    };
  },
});

export const getProjectDetails = action({
  args: { sessionId: v.string(), v0ProjectId: v.string() },
  returns: v.any(),
  handler: async (ctx, args): Promise<Record<string, unknown>> => {
    const project = await v0.projects.getById({ projectId: args.v0ProjectId });
    const chats = (project as any).chats || [];

    const convexProjectId: Id<"projects"> = await ctx.runMutation(
      internal.projects.createFromV0,
      {
        sessionId: args.sessionId,
        v0ProjectId: args.v0ProjectId,
        name: project.name || "Untitled Project",
      }
    );

    for (const chat of chats) {
      await ctx.runMutation(internal.chats.upsertFromV0, {
        sessionId: args.sessionId,
        projectId: convexProjectId,
        v0ChatId: chat.id,
        v0ProjectId: args.v0ProjectId,
        name: chat.name,
        title: chat.title,
        demoUrl: chat.demo,
        v0Url: chat.url,
        latestVersionId: chat.latestVersion?.id,
        latestVersionStatus: chat.latestVersion?.status,
      });
    }

    return { ...project, chats, convexProjectId };
  },
});

export const getChatDetails = action({
  args: { v0ChatId: v.string() },
  returns: v.any(),
  handler: async (_ctx, args): Promise<unknown> => {
    const chat = await v0.chats.getById({ chatId: args.v0ChatId });
    return chat;
  },
});

export const deleteChat = action({
  args: { chatId: v.id("chats"), v0ChatId: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await v0.chats.delete({ chatId: args.v0ChatId });
    await ctx.runMutation(internal.chats.removeInternal, {
      chatId: args.chatId,
    });
    return null;
  },
});

export const renameChat = action({
  args: { chatId: v.id("chats"), v0ChatId: v.string(), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await v0.chats.update({ chatId: args.v0ChatId, name: args.name });
    await ctx.runMutation(internal.chats.renameInternal, {
      chatId: args.chatId,
      name: args.name,
    });
    return null;
  },
});

export const forkChat = action({
  args: {
    sessionId: v.string(),
    v0ChatId: v.string(),
    v0ProjectId: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<unknown> => {
    const forkedChat = await v0.chats.fork({
      chatId: args.v0ChatId,
      ...(args.v0ProjectId && { projectId: args.v0ProjectId }),
    });

    const v0ProjectId = (forkedChat as any).projectId || args.v0ProjectId;
    if (v0ProjectId) {
      const convexProjectId: Id<"projects"> = await ctx.runMutation(
        internal.projects.createFromV0,
        {
          sessionId: args.sessionId,
          v0ProjectId: v0ProjectId,
          name: "Untitled Project",
        }
      );

      await ctx.runMutation(internal.chats.upsertFromV0, {
        sessionId: args.sessionId,
        projectId: convexProjectId,
        v0ChatId: (forkedChat as any).id,
        v0ProjectId: v0ProjectId,
        name: (forkedChat as any).name,
        title: (forkedChat as any).title,
        demoUrl: (forkedChat as any).demo,
        v0Url: (forkedChat as any).url,
        latestVersionId: (forkedChat as any).latestVersion?.id,
        latestVersionStatus: (forkedChat as any).latestVersion?.status,
      });
    }

    return forkedChat;
  },
});

export const deploy = action({
  args: {
    v0ProjectId: v.string(),
    v0ChatId: v.string(),
    versionId: v.string(),
  },
  returns: v.any(),
  handler: async (_ctx, args): Promise<unknown> => {
    try {
      const result = await v0.deployments.create({
        projectId: args.v0ProjectId,
        chatId: args.v0ChatId,
        versionId: args.versionId,
      });
      return result;
    } catch (deployError: any) {
      if (
        deployError instanceof Error &&
        deployError.message.includes("Project has no Vercel project ID")
      ) {
        const project = await v0.projects.getById({
          projectId: args.v0ProjectId,
        });
        const vercelProjectName =
          project.name || `v0-project-${args.v0ProjectId}`;

        await v0.integrations.vercel.projects.create({
          projectId: args.v0ProjectId,
          name: vercelProjectName,
        });

        const result = await v0.deployments.create({
          projectId: args.v0ProjectId,
          chatId: args.v0ChatId,
          versionId: args.versionId,
        });
        return result;
      }
      throw deployError;
    }
  },
});

export const validateApiKey = action({
  args: {},
  returns: v.any(),
  handler: async (): Promise<Record<string, unknown>> => {
    try {
      const user = await v0.user.get();
      return { valid: true, user };
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || "";
      if (
        msg.includes("api key is required") ||
        msg.includes("v0_api_key") ||
        msg.includes("config.apikey")
      ) {
        return { valid: false, error: "API_KEY_MISSING" };
      }
      return { valid: false, error: msg };
    }
  },
});
