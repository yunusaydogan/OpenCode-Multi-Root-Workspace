import { Plugin, Command, MenuItem } from "@opencode/plugin/gui";
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
        const session = current();
        if (!ctx.desktop)
          throw new Error(
            "Workspace oluşturmak için OpenCode Desktop kullanın.",
          );
        const name = await ctx.dialogs.prompt({
          title: "Yeni Workspace",
          description: "Workspace için bir ad girin. Örnek: Personel Portalı",
          placeholder: "Workspace adı",
          submit: "Devam et",
        });
        if (!name) return;
        const folders: string[] = [];
        while (true) {
          const selected = await ctx.desktop.pick({
            directory: true,
            multiple: true,
            title: "Workspace klasörlerini seçin",
          });
          for (const folder of selected)
            if (!folders.includes(folder)) folders.push(folder);
          if (!folders.length) return;
          const action = await ctx.dialogs.select({
            title: `${folders.length} klasör seçildi`,
            options: [
              {
                title: "Başka klasör ekle",
                value: "add",
                description:
                  "Farklı konumlardaki repoları da ekleyebilirsiniz.",
              },
              {
                title: "Devam et",
                value: "finish",
                description: folders.join(" · "),
              },
              { title: "İptal", value: "cancel" },
            ],
          });
          if (action === "finish") break;
          if (action !== "add") return;
        }
        const access = await ctx.dialogs.select({
          title: "Workspace erişimi",
          current: "read",
          options: [
            {
              title: "Yalnızca okuma",
              value: "read",
              description: "Dosyaları incele, Git status/diff göster.",
            },
            {
              title: "Dosya düzenleme",
              value: "files",
              description:
                "Dosyaları onayla düzenle. Git değişiklikleri kapalı.",
            },
            {
              title: "Dosya düzenleme ve Git işlemleri",
              value: "all",
              description:
                "Dosya yazma, stage, commit ve push ayrı izinlerle kullanılabilir.",
            },
          ],
        });
        if (!access) return;
        const [directory] = await ctx.desktop.pick({
          directory: true,
          title: "Workspace dosyasının kaydedileceği klasörü seçin",
        });
        if (!directory) return;
        if (
          !(await ctx.dialogs.confirm({
            title: "Workspace oluştur",
            description: `${name}\n\nKlasörler:\n${folders.join("\n")}\n\nKaydetme konumu: ${directory}\n\nSeçilen klasörlerin Git repo kökü olması gerekir. Mevcut dosyaların üzerine yazılmaz.`,
            confirm: "Oluştur ve aç",
            cancel: "İptal",
          }))
        )
          return;
        if (
          ctx.sessions.current()?.key !== session.key ||
          ctx.sessions.current()?.location?.directory !==
            session.location?.directory
        )
          throw new Error(
            "Sohbet değişti. Workspace oluşturmayı yeniden başlatın.",
          );
        return session.server.client.rpc(WorkspaceRpc).create(
          {
            sessionID: session.id,
            name,
            directory,
            folders,
            allowFileWrites: access !== "read",
            allowGitWrites: access === "all",
          },
          { location: session.location },
        );
      });
    ctx.add(Command, () => ({
      id: "create",
      title: "Multi-Root Workspace: Yeni Workspace",
      keywords: "new create oluştur klasör frontend backend",
      run: create,
    }));
    ctx.add(MenuItem, () => ({
      id: "new-workspace",
      menu: "session.panel" as const,
      title: "Yeni Workspace",
      icon: "folder" as const,
      run: () => {
        void create();
      },
    }));
  },
});
