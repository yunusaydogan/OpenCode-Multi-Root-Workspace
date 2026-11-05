import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
export const WorkspaceRpc = Rpc.define({
  id: "multi-root-workspace",
  methods: {
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
