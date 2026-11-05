import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { loadWorkspace } from "./core.mjs";
const id = (path) => createHash("sha256").update(resolve(path)).digest("hex");
export function workspaceCatalog(storage) {
  const hidden = (manifest) => `workspace-hidden:${id(manifest)}`;
  const key = (manifest) => `workspace:${id(manifest)}`;
  const remember = async (manifest, signal) => {
    const ws = await loadWorkspace(manifest, signal);
    const item = {
      manifest: ws.manifest,
      name: ws.name,
      roots: ws.roots.length,
      updatedAt: Date.now(),
    };
    await storage.set(key(ws.manifest), item);
    await storage.remove(hidden(ws.manifest));
    return item;
  };
  const scan = async (prefix) => {
    const items = [];
    let after;
    do {
      const page = await storage.scan({ prefix, after, limit: 200 });
      items.push(...page.entries);
      after = page.next;
    } while (after && items.length < 1000);
    return items;
  };
  return {
    remember,
    async list() {
      const saved = await scan("workspace:");
      const byPath = new Map(
        saved
          .filter(
            (e) =>
              e.value &&
              typeof e.value === "object" &&
              typeof e.value.manifest === "string",
          )
          .map((e) => [e.value.manifest, e.value]),
      );
      for (const e of await scan("session:")) {
        if (
          !e.key.endsWith(":manifest") ||
          typeof e.value !== "string" ||
          byPath.has(e.value) ||
          (await storage.get(hidden(e.value)))
        )
          continue;
        try {
          const item = await remember(e.value);
          byPath.set(item.manifest, item);
        } catch {
          /* orphaned legacy selections are not list entries */
        }
      }
      const result = [];
      for (const item of [...byPath.values()]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 200)) {
        try {
          const ws = await loadWorkspace(item.manifest);
          result.push({
            ...item,
            name: ws.name,
            roots: ws.roots.length,
            available: true,
          });
        } catch {
          result.push({ ...item, available: false });
        }
      }
      return result;
    },
    async forget(manifest) {
      await storage.remove(key(manifest));
      await storage.set(hidden(manifest), true);
    },
  };
}
