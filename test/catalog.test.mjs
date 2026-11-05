import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { workspaceCatalog } from "../src/catalog.mjs";
test("catalog remembers workspaces across sessions, imports legacy selections and forgets without deleting files", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "workspace-catalog-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repo = join(base, "repo");
  await mkdir(repo);
  execFileSync("git", ["init", "-q", repo]);
  const manifest = join(base, "test.workspace");
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      name: "Saved portal",
      roots: [{ name: "app", path: repo }],
    }),
  );
  const entries = new Map([["session:old:manifest", manifest]]);
  const storage = {
    get: async (k) => entries.get(k),
    set: async (k, v) => entries.set(k, v),
    remove: async (k) => entries.delete(k),
    scan: async ({ prefix }) => ({
      entries: [...entries]
        .filter(([k]) => k.startsWith(prefix))
        .map(([key, value]) => ({ key, value })),
    }),
  };
  const catalog = workspaceCatalog(storage);
  assert.equal((await catalog.list())[0].name, "Saved portal");
  await catalog.remember(manifest);
  assert.equal((await catalog.list()).length, 1);
  await catalog.forget(manifest);
  assert.equal((await catalog.list()).length, 0);
  await catalog.remember(manifest);
  assert.equal((await catalog.list()).length, 1);
  await rm(manifest);
  const missing = await catalog.list();
  assert.equal(missing[0].available, false);
});
