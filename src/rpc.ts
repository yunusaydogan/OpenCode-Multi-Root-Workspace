import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
export const WorkspaceRpc = Rpc.define({
  id: "multi-root-workspace",
  methods: {
    list: {
      input: z.object({}),
      output: z.array(
        z.object({
          manifest: z.string(),
          name: z.string(),
          roots: z.number(),
          updatedAt: z.number(),
          available: z.boolean(),
        }),
      ),
    },
    forget: { input: z.object({ manifest: z.string() }), output: z.string() },
    open: {
      input: z.object({ manifest: z.string() }),
      output: z.object({ sessionID: z.string(), manifest: z.string() }),
    },
    createSaved: {
      input: z.object({
        name: z.string().min(1).max(120),
        directory: z.string(),
        folders: z.array(z.string()).min(1).max(32),
        allowFileWrites: z.boolean(),
        allowGitWrites: z.boolean(),
      }),
      output: z.object({ manifest: z.string() }),
    },

    create: {
      input: z.object({
        sessionID: z.string(),
        name: z.string().min(1).max(120),
        directory: z.string(),
        folders: z.array(z.string()).min(1).max(32),
        allowFileWrites: z.boolean(),
        allowGitWrites: z.boolean(),
      }),
      output: z.string(),
    },
    select: {
      input: z.object({ sessionID: z.string(), manifest: z.string() }),
      output: z.string(),
    },
    status: { input: z.object({ sessionID: z.string() }), output: z.string() },
    clear: { input: z.object({ sessionID: z.string() }), output: z.string() },
  },
  events: {},
});
