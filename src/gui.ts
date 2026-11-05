import { Plugin, Command } from "@opencode/plugin/gui";
import { WorkspaceRpc } from "./rpc.ts";
export default Plugin.define({
  os: ["linux", "macos", "windows"],
  setup(ctx) {
    const current = () => {
      const s = ctx.sessions.current();
      if (!s?.location || !s.server.builtin || s.pending)
        throw new Error(
          "Open an existing session on the Desktop local server first. Remote servers and draft tabs are not supported.",
        );
      return s;
    };
    const report = async (action: () => Promise<string | undefined>) => {
      try {
        const result = await action();
        if (result)
          await ctx.dialogs.alert({
            title: "Multi-Root Workspace",
            description: result,
          });
      } catch (error) {
        await ctx.dialogs.alert({
          title: "Multi-Root Workspace error",
          description: error instanceof Error ? error.message : String(error),
        });
      }
    };
    ctx.add(Command, () => ({
      id: "open",
      title: "Multi-Root Workspace: Open .workspace",
      keywords: "frontend backend repo manifest",
      run: () =>
        report(async () => {
          const session = current();
          const [manifest] =
            (await ctx.desktop?.pick({
              extensions: ["workspace"],
              title: "Open Multi-Root Workspace",
            })) ?? [];
          if (!manifest) return;
          if (ctx.sessions.current()?.key !== session.key)
            throw new Error(
              "Session changed while picking a manifest. Try again.",
            );
          return session.server.client
            .rpc(WorkspaceRpc)
            .select(
              { sessionID: session.id, manifest },
              { location: session.location },
            );
        }),
    }));
    ctx.add(Command, () => ({
      id: "status",
      title: "Multi-Root Workspace: Status",
      run: () =>
        report(async () => {
          const s = current();
          return s.server.client
            .rpc(WorkspaceRpc)
            .status({ sessionID: s.id }, { location: s.location });
        }),
    }));
    ctx.add(Command, () => ({
      id: "clear",
      title: "Multi-Root Workspace: Clear selection",
      run: () =>
        report(async () => {
          const s = current();
          return s.server.client
            .rpc(WorkspaceRpc)
            .clear({ sessionID: s.id }, { location: s.location });
        }),
    }));
  },
});
