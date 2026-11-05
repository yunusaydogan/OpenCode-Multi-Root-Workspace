import { workspaceCatalog } from "./catalog.mjs";
import { relative, isAbsolute, sep, parse, dirname } from "node:path";
import { Plugin } from "@opencode/plugin";
import { z } from "zod";
import {
  loadWorkspace,
  createWorkspace,
  workspaceContext,
  fileOperation,
  fileAccessPath,
  gitOperation,
} from "./core.mjs";
import { WorkspaceRpc } from "./rpc.ts";

const root = z
  .string()
  .min(1)
  .describe("Exact manifest root name, e.g. frontend or backend");
const files = z.discriminatedUnion("op", [
  z.object({ op: z.literal("list"), root }),
  z.object({ op: z.literal("read"), root, path: z.string() }),
  z.object({
    op: z.literal("write"),
    root,
    path: z.string(),
    content: z.string(),
    expected: z
      .string()
      .nullable()
      .describe("Exact old text, or null to create; read before updating"),
  }),
]);
const git = z.discriminatedUnion("op", [
  z.object({ op: z.literal("status"), root }),
  z.object({ op: z.literal("diff"), root, staged: z.boolean().optional() }),
  z.object({
    op: z.literal("stage"),
    root,
    paths: z.array(z.string()).min(1).max(100),
    confirmed: z.literal(true),
  }),
  z.object({
    op: z.literal("commit"),
    root,
    message: z.string().min(1).max(4000),
    confirmed: z.literal(true),
  }),
  z.object({ op: z.literal("push"), root, confirmed: z.literal(true) }),
]);
export default Plugin.define({
  id: "multi-root-workspace",
  async setup(ctx) {
    const registrations: { dispose: () => Promise<void> }[] = [];
    registrations.push(
      await ctx.permission.hook("evaluate", (event) => {
        if (
          ["workspace_write", "workspace_git_write"].includes(event.action) &&
          event.effect !== "deny"
        )
          event.effect = "ask";
      }),
    );
    const external = async (
      path: string,
      call: { sessionID: any; agent: any },
    ) => {
      const internal = [
        ctx.location.directory,
        ctx.location.project.directory,
      ].some((base) => {
        if (parse(base).root === base) return false;
        const rel = relative(base, path);
        return (
          rel === "" ||
          (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep))
        );
      });
      if (!internal)
        await ctx.permission.assert({
          sessionID: call.sessionID,
          agent: call.agent,
          action: "external_directory",
          resources: [path + "/*"],
        });
    };
    const catalog = workspaceCatalog(ctx.storage);
    const key = (sessionID: string) => `session:${sessionID}:manifest`;
    const workspace = async (sessionID: string, signal?: AbortSignal) => {
      const selected = await ctx.storage.get(key(sessionID));
      const manifest =
        typeof selected === "string" ? selected : ctx.options.manifest;
      if (typeof manifest !== "string")
        throw new Error(
          "No workspace selected. Use Desktop: Multi-Root Workspace: Open .workspace",
        );
      return loadWorkspace(manifest, signal);
    };
    registrations.push(
      await ctx.rpc.register(WorkspaceRpc, {
        list: async () => catalog.list(),
        forget: async ({ manifest }) => {
          await catalog.forget(manifest);
          return "Listeden kaldırıldı. Workspace dosyası ve sohbetler korunuyor.";
        },
        open: async ({ manifest }, call) => {
          const ws = await loadWorkspace(manifest, call.signal);
          const session = await ctx.session.create({
            title: ws.name,
            location: { directory: dirname(ws.manifest) },
          });
          await ctx.storage.set(key(session.id), ws.manifest);
          await catalog.remember(ws.manifest, call.signal);
          return { sessionID: session.id, manifest: ws.manifest };
        },
        createSaved: async (input, call) => {
          const ws = await createWorkspace(input, call.signal);
          await catalog.remember(ws.manifest, call.signal);
          return { manifest: ws.manifest };
        },
        create: async (input, call) => {
          const ws = await createWorkspace(input, call.signal);
          await ctx.storage.set(key(input.sessionID), ws.manifest);
          await catalog.remember(ws.manifest, call.signal);
          return `“${ws.name}” oluşturuldu ve bu sohbet için açıldı.\n\nDosya: ${ws.manifest}\n\nKlasörler:\n${ws.roots.map((r) => `${r.name}: ${r.path}`).join("\n")}`;
        },
        select: async ({ sessionID, manifest }, call) => {
          // Validate before replacing the previous selection. No writes to user repos.
          const ws = await loadWorkspace(manifest, call.signal);
          await ctx.storage.set(key(sessionID), ws.manifest);
          await catalog.remember(ws.manifest, call.signal);
          return workspaceContext(ws);
        },
        status: async ({ sessionID }, call) => {
          const ws = await workspace(sessionID, call.signal);
          const statuses = await Promise.all(
            ws.roots.map(
              async (r) =>
                `${r.name}\n${await gitOperation(ws, { op: "status", root: r.name }, call.signal)}`,
            ),
          );
          return `${workspaceContext(ws)}\n\n${statuses.join("\n")}`;
        },
        clear: async ({ sessionID }) => {
          await ctx.storage.remove(key(sessionID));
          return "Selection cleared. A configured default manifest, if any, still applies.";
        },
      }),
    );
    registrations.push(
      await ctx.session.hook("context", async (event) => {
        const selected = await ctx.storage.get(key(event.sessionID));
        if (!selected && typeof ctx.options.manifest !== "string") return;
        // Invalid/moved manifests fail closed, rather than falling back to an old root mapping.
        event.system.push({
          type: "text",
          text: workspaceContext(await workspace(event.sessionID)),
        });
      }),
    );
    registrations.push(
      await ctx.tool.transform((editor) => {
        editor.add({
          name: "workspace_info",
          description:
            "Show the selected multi-root workspace, capabilities and canonical repository paths.",
          input: z.object({}),
          options: { codemode: false },
          execute: async (_args, call) => ({
            content: workspaceContext(
              await workspace(call.sessionID, call.signal),
            ),
          }),
        });
        editor.add({
          name: "workspace_files",
          description:
            "List/read/write text files in an explicitly named workspace repo. Writes require permission and expected old text, and have no native undo.",
          input: files,
          options: { codemode: false },
          execute: async (args, call) => {
            const ws = await workspace(call.sessionID, call.signal);
            const r = ws.roots.find((r) => r.name === args.root);
            if (!r) throw new Error("Unknown root");
            if (args.op === "write" && !ws.allowFileWrites)
              throw new Error("File writes are disabled by manifest");
            const path = await fileAccessPath(ws, args, call.signal);
            await external(r.path, call);
            await ctx.permission.assert({
              sessionID: call.sessionID,
              agent: call.agent,
              action: args.op === "write" ? "edit" : "read",
              resources: [path],
            });
            await ctx.permission.assert({
              sessionID: call.sessionID,
              agent: call.agent,
              action:
                args.op === "write" ? "workspace_write" : "workspace_read",
              resources: [path],
              metadata: {
                operation: args.op,
                root: args.root,
                ...(args.op === "write"
                  ? {
                      path: args.path,
                      expected: args.expected,
                      content: args.content,
                    }
                  : {}),
              },
            });
            return { content: await fileOperation(ws, args, call.signal) };
          },
        });
        editor.add({
          name: "workspace_git",
          description:
            "Git status/diff/stage/commit/push for one named repo. Obtain user confirmation for writes. Commit includes ALL staged files. Push uses current branch upstream only.",
          input: git,
          options: { codemode: false },
          execute: async (args, call) => {
            const ws = await workspace(call.sessionID, call.signal);
            const r = ws.roots.find((r) => r.name === args.root);
            if (!r) throw new Error("Unknown root");
            const mutation = ["stage", "commit", "push"].includes(args.op);
            if (mutation && !ws.allowGitWrites)
              throw new Error("Git writes are disabled by manifest");
            await external(r.path, call);
            const stagedDiff =
              args.op === "commit"
                ? await gitOperation(
                    ws,
                    { root: args.root, op: "diff", staged: true },
                    call.signal,
                  )
                : undefined;
            await ctx.permission.assert({
              sessionID: call.sessionID,
              agent: call.agent,
              action: mutation ? "workspace_git_write" : "workspace_git_read",
              resources: [`${r.path}:${args.op}`],
              metadata: {
                ...args,
                ...(stagedDiff !== undefined ? { stagedDiff } : {}),
              },
            });
            return { content: await gitOperation(ws, args, call.signal) };
          },
        });
      }),
    );
    return async () => {
      for (const r of registrations.reverse()) await r.dispose();
    };
  },
});
