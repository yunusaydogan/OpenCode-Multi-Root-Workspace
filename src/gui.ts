import { Plugin, Command, MenuItem, TitlebarItem } from "@opencode/plugin/gui";
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
    const report = async (action: () => Promise<string | void>) => {
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
          if (
            ctx.sessions.current()?.key !== session.key ||
            ctx.sessions.current()?.location?.directory !==
              session.location?.directory
          )
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
    const create = () =>
      report(async () => {
        if (!ctx.desktop)
          throw new Error("Use OpenCode Desktop to create a workspace.");
        const name = await ctx.dialogs.prompt({
          title: "New Workspace",
          description: "Enter a workspace name, for example: Personnel Portal",
          placeholder: "Workspace name",
          submit: "Continue",
        });
        if (!name) return;
        const folders: string[] = [];
        while (true) {
          const selected = await ctx.desktop.pick({
            directory: true,
            multiple: true,
            title: "Select workspace repository folders",
          });
          for (const folder of selected)
            if (!folders.includes(folder)) folders.push(folder);
          if (!folders.length) return;
          const action = await ctx.dialogs.select({
            title: `${folders.length} folder(s) selected`,
            placeholder: "Add another folder or choose Continue",
            current: "finish",
            options: [
              {
                title: "Add another folder",
                value: "add",
                description:
                  "You can add repositories from different locations.",
              },
              {
                title: "Continue",
                value: "finish",
                description: folders.join(" · "),
              },
              { title: "Cancel", value: "cancel" },
            ],
          });
          if (action === "finish") break;
          if (action !== "add") return;
        }
        const access = await ctx.dialogs.select({
          title: "Workspace access",
          placeholder: "Choose an access level for this workspace",
          current: "read",
          options: [
            {
              title: "Read-only",
              value: "read",
              description: "Inspect files and view Git status/diff.",
            },
            {
              title: "File editing",
              value: "files",
              description:
                "Edit files with approval. Git mutations remain disabled.",
            },
            {
              title: "File editing and Git operations",
              value: "all",
              description:
                "Write files, stage, commit, and push with separate permission checks.",
            },
          ],
        });
        if (!access) return;
        const defaults = await ctx.client.rpc(WorkspaceRpc).defaults({});
        const saveMode = await ctx.dialogs.select({
          title: "Save workspace file",
          placeholder: "Where should the workspace file be saved?",
          current: "default",
          options: [
            {
              title: "Save to default location",
              value: "default",
              description: defaults.directory,
            },
            {
              title: "Choose a different save folder",
              value: "custom",
              description:
                "Choose where to store the .workspace file, not another repository.",
            },
            { title: "Cancel", value: "cancel" },
          ],
        });
        if (!saveMode || saveMode === "cancel") return;
        let directory: string | undefined;
        if (saveMode === "custom") {
          [directory] = await ctx.desktop.pick({
            directory: true,
            title: "Choose a save folder for the workspace file",
          });
          if (!directory) return;
        }
        if (
          !(await ctx.dialogs.confirm({
            title: "Create workspace",
            description: `${name}\n\nRepository folders:\n${folders.join("\n")}\n\nWorkspace file location: ${directory ?? defaults.directory}\n\nSelected folders must be Git repository roots. Existing files will not be overwritten.`,
            confirm: "Create and open",
            cancel: "Cancel",
          }))
        )
          return;
        const saved = await ctx.client.rpc(WorkspaceRpc).createSaved({
          name,
          ...(directory ? { directory } : {}),
          folders,
          allowFileWrites: access !== "read",
          allowGitWrites: access === "all",
        });
        try {
          await openSaved(saved.manifest);
        } catch (error) {
          throw new Error(
            `Workspace file saved: ${saved.manifest}\nThe conversation could not be opened. Reopen the saved file from Workspaces.\n${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return `“${name}” was saved and opened.\n\nWorkspace file: ${saved.manifest}`;
      });
    ctx.add(Command, () => ({
      id: "create",
      title: "Multi-Root Workspace: New Workspace",
      keywords: "new create folders repositories frontend backend",
      run: create,
    }));
    ctx.add(MenuItem, () => ({
      id: "new-workspace",
      menu: "session.panel" as const,
      title: "New Workspace",
      icon: "folder" as const,
      run: () => {
        void create();
      },
    }));
    const openSaved = async (manifest: string) => {
      const result = await ctx.client.rpc(WorkspaceRpc).open({ manifest });
      ctx.tabs.open(
        { server: "sidecar", id: result.sessionID },
        { focus: true },
      );
    };
    const hub = () =>
      report(async () => {
        while (true) {
          const items = await ctx.client.rpc(WorkspaceRpc).list({});
          const choice = await ctx.dialogs.select({
            title: "Workspaces",
            options: [
              {
                title: "New Workspace",
                value: "new",
                description:
                  "Name your workspace, select Git folders, and save.",
              },
              {
                title: "Add existing workspace",
                value: "import",
                description:
                  "Choose a .workspace file to add it to the list and open it.",
              },
              ...items.map((item) => ({
                title:
                  item.name +
                  (item.available ? "" : " — file or repository not found"),
                value: "open:" + item.manifest,
                description: `${item.roots} repo · ${item.manifest}`,
              })),
              ...(items.length
                ? [
                    {
                      title: "Remove workspace from list",
                      value: "remove",
                      description:
                        "Keeps workspace files, repositories, and conversations.",
                    },
                  ]
                : []),
            ],
          });
          if (!choice) return;
          if (choice === "new") {
            await create();
            return;
          }
          if (choice === "import") {
            const [manifest] =
              (await ctx.desktop?.pick({
                extensions: ["workspace"],
                title: "Select a workspace file",
              })) ?? [];
            if (manifest) await openSaved(manifest);
            return;
          }
          if (choice === "remove") {
            const manifest = await ctx.dialogs.select({
              title: "Choose a workspace to remove from the list",
              options: items.map((item) => ({
                title: item.name,
                value: item.manifest,
                description: item.manifest,
              })),
            });
            if (
              manifest &&
              (await ctx.dialogs.confirm({
                title: "Remove from list?",
                description:
                  "The workspace file, repositories, and existing conversations will be kept.",
                confirm: "Remove from list",
              }))
            )
              await ctx.client.rpc(WorkspaceRpc).forget({ manifest });
            continue;
          }
          if (choice.startsWith("open:")) {
            await openSaved(choice.slice(5));
            return;
          }
        }
      });
    ctx.add(Command, () => ({
      id: "workspaces",
      title: "Workspaces",
      keywords: "home list saved workspaces projects",
      run: hub,
    }));
    ctx.add(MenuItem, () => ({
      id: "workspaces",
      menu: "session.panel" as const,
      title: "Workspaces",
      icon: "folder" as const,
      run: () => {
        void hub();
      },
    }));
    ctx.add(TitlebarItem, () => ({
      id: "workspaces",
      label: "Workspaces",
      title: "Workspaces — create, open, and manage",
      icon: "folder" as const,
      run: () => {
        void hub();
      },
    }));
  },
});
