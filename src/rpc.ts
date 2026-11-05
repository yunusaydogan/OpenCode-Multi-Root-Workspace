import { Rpc } from "@opencode/plugin/rpc";
import { z } from "zod";
export const WorkspaceRpc = Rpc.define({
  id: "multi-root-workspace",
  methods: {
    select: {
      input: z.object({ sessionID: z.string(), manifest: z.string() }),
      output: z.string(),
    },
    status: { input: z.object({ sessionID: z.string() }), output: z.string() },
    clear: { input: z.object({ sessionID: z.string() }), output: z.string() },
  },
  events: {},
});
