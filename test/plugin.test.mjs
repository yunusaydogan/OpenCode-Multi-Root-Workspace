import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import plugin from "../src/index.ts";
import gui from "../src/gui.ts";
async function setup(t) {
  const base = await mkdtemp(join(tmpdir(), "oc-plugin-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const repo = join(base, "repo");
  await mkdir(repo);
  execFileSync("git", ["init", "-q", repo]);
  await writeFile(join(repo, "a.txt"), "old");
  const manifest = join(base, "demo.workspace");
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      name: "Demo",
      roots: [{ name: "app", path: "repo" }],
      allowFileWrites: true,
    }),
  );
  const storage = new Map(),
    tools = {},
    hooks = {},
    disposed = [];
  let rpc;
  let denied = false;
  const permissions = [];
  const registration = () => ({ dispose: async () => disposed.push(true) });
  const ctx = {
    location: { directory: base, project: { directory: base } },
    options: {},
    storage: {
      get: async (k) => storage.get(k),
      set: async (k, v) => storage.set(k, v),
      remove: async (k) => storage.delete(k),
    },
    rpc: {
      register: async (_d, h) => {
        rpc = h;
        return registration();
      },
    },
    session: {
      hook: async (n, h) => {
        hooks[n] = h;
        return registration();
      },
    },
    tool: {
      transform: async (fn) => {
        fn({ add: (t) => (tools[t.name] = t) });
        return registration();
      },
    },
    permission: {
      hook: async (n, h) => {
        hooks["permission:" + n] = h;
        return registration();
      },
      assert: async (p) => {
        permissions.push(p);
        if (denied) throw Error("denied");
      },
    },
  };
  const cleanup = await plugin.setup(ctx);
  return {
    base,
    repo,
    manifest,
    storage,
    tools,
    hooks,
    rpc,
    cleanup,
    disposed,
    permissions,
    deny: () => (denied = true),
  };
}
const call = (sessionID = "ses_a") => ({
  sessionID,
  agent: "build",
  signal: new AbortController().signal,
});
test("session selections use persistent storage and invalid selection preserves the previous manifest", async (t) => {
  const f = await setup(t);
  await f.rpc.select({ sessionID: "ses_a", manifest: f.manifest }, call());
  assert.match(
    (await f.tools.workspace_info.execute({}, call())).content,
    /Demo/,
  );
  await assert.rejects(
    f.tools.workspace_info.execute({}, call("ses_b")),
    /No workspace/,
  );
  await assert.rejects(
    f.rpc.select(
      { sessionID: "ses_a", manifest: join(f.base, "missing.workspace") },
      call(),
    ),
  );
  assert.match(
    (await f.tools.workspace_info.execute({}, call())).content,
    /Demo/,
  );
  const event = { sessionID: "ses_a", system: [] };
  await f.hooks.context(event);
  assert.match(event.system[0].text, /app/);
  const other = { sessionID: "ses_b", system: [] };
  await f.hooks.context(other);
  assert.deepEqual(other.system, []);
  await f.cleanup();
  assert.equal(f.disposed.length, 4);
});
test("permission rejection is propagated and no file is written", async (t) => {
  const f = await setup(t);
  await f.rpc.select({ sessionID: "ses_a", manifest: f.manifest }, call());
  f.deny();
  await assert.rejects(
    f.tools.workspace_files.execute(
      {
        op: "write",
        root: "app",
        path: "a.txt",
        expected: "old",
        content: "bad",
      },
      call(),
    ),
    /denied/,
  );
  assert.equal(await readFile(join(f.repo, "a.txt"), "utf8"), "old");
  assert.equal(f.permissions.at(-1).action, "edit");
});
test("manifest is revalidated on every use; clearing one session leaves others selected", async (t) => {
  const f = await setup(t);
  for (const sessionID of ["ses_a", "ses_b"])
    await f.rpc.select({ sessionID, manifest: f.manifest }, call());
  await f.rpc.clear({ sessionID: "ses_a" });
  await assert.rejects(
    f.tools.workspace_info.execute({}, call()),
    /No workspace/,
  );
  assert.match(
    (await f.tools.workspace_info.execute({}, call("ses_b"))).content,
    /Demo/,
  );
  await writeFile(f.manifest, "{}");
  await assert.rejects(f.tools.workspace_info.execute({}, call("ses_b")));
});
test("GUI selection passes session location; cancellation and session switch never select a manifest", async () => {
  const commands = [];
  const rpcCalls = [];
  const alerts = [];
  let cancelled = false,
    switched = false;
  const session = {
    key: "sidecar\nses_a",
    id: "ses_a",
    location: { directory: "/project" },
    server: {
      builtin: true,
      client: {
        rpc: () => ({
          select: async (...a) => {
            rpcCalls.push(a);
            return "selected";
          },
        }),
      },
    },
  };
  const ctx = {
    add: (_r, cmd) => commands.push(cmd()),
    sessions: {
      current: () => (switched ? { ...session, key: "other" } : session),
    },
    desktop: {
      pick: async () => (cancelled ? [] : ["/project/demo.workspace"]),
    },
    dialogs: { alert: async (a) => alerts.push(a) },
  };
  gui.setup(ctx);
  await commands.find((c) => c.id === "open").run();
  assert.deepEqual(rpcCalls[0], [
    { sessionID: "ses_a", manifest: "/project/demo.workspace" },
    { location: session.location },
  ]);
  cancelled = true;
  await commands[0].run();
  assert.equal(rpcCalls.length, 1);
  cancelled = false;
  ctx.desktop.pick = async () => {
    switched = true;
    return ["/other.workspace"];
  };
  await commands[0].run();
  assert.equal(rpcCalls.length, 1);
  assert.match(alerts.at(-1).description, /Session changed/);
});
test("custom write guard never upgrades deny and requires ask even under broad allow rules", async (t) => {
  const f = await setup(t);
  for (const action of ["workspace_write", "workspace_git_write"]) {
    const allowed = { action, effect: "allow" };
    await f.hooks["permission:evaluate"](allowed);
    assert.equal(allowed.effect, "ask");
    const denied = { action, effect: "deny" };
    await f.hooks["permission:evaluate"](denied);
    assert.equal(denied.effect, "deny");
  }
});
test("creation ignores an active chat whose old project directory is missing", async () => {
  const commands = [],
    requests = [],
    opened = [],
    alerts = [];
  const session = {
    key: "stale",
    id: "ses_old",
    location: { directory: "/missing/project" },
    server: {
      builtin: true,
      client: {
        rpc: () => {
          throw Error("Must not use stale session RPC");
        },
      },
    },
  };
  const choices = ["add", "finish", "all", "custom"];
  const picks = [["/frontend"], ["/backend"], ["/saved"]];
  const ctx = {
    add: (_r, fn) => commands.push(fn()),
    sessions: { current: () => session },
    client: {
      rpc: () => ({
        defaults: async () => ({ directory: "/default/workspaces" }),
        createSaved: async (input) => {
          requests.push(input);
          return { manifest: "/saved/portal.workspace" };
        },
        open: async () => ({ sessionID: "ses_new" }),
      }),
    },
    tabs: { open: (args) => opened.push(args) },
    desktop: { pick: async () => picks.shift() },
    dialogs: {
      prompt: async () => "Personel Portalı",
      select: async () => choices.shift(),
      confirm: async () => true,
      alert: async (a) => alerts.push(a),
    },
  };
  gui.setup(ctx);
  await commands.find((c) => c.id === "create").run();
  assert.deepEqual(requests[0], {
    name: "Personel Portalı",
    directory: "/saved",
    folders: ["/frontend", "/backend"],
    allowFileWrites: true,
    allowGitWrites: true,
  });
  assert.equal(opened[0].id, "ses_new");
  assert.match(alerts[0].description, /saved\/portal.workspace/);
  requests.length = 0;
  ctx.dialogs.prompt = async () => undefined;
  await commands.find((c) => c.id === "create").run();
  assert.equal(requests.length, 0);
});
test("workspace hub works on Home and opens a saved workspace in a local tab", async () => {
  const commands = [],
    opened = [];
  const manifest = "/saved/portal.workspace";
  const ctx = {
    add: (_r, fn) => commands.push(fn()),
    sessions: { current: () => undefined },
    client: {
      rpc: () => ({
        list: async () => [
          { name: "Portal", manifest, roots: 2, available: true },
        ],
        open: async ({ manifest: path }) => {
          assert.equal(path, manifest);
          return { sessionID: "ses_saved", manifest };
        },
      }),
    },
    tabs: { open: (...args) => opened.push(args) },
    dialogs: {
      select: async () => "open:" + manifest,
      alert: async (e) => {
        throw Error(e.description);
      },
    },
    ui: { Button: (props) => props },
  };
  gui.setup(ctx);
  await commands.find((c) => c.id === "workspaces" && c.keywords).run();
  assert.deepEqual(opened, [
    [{ server: "sidecar", id: "ses_saved" }, { focus: true }],
  ]);
  assert.equal(
    commands.some((c) => c.at === "window.bottom"),
    false,
  );
  const shortcut = commands.find(
    (c) => c.id === "workspaces" && c.icon === "folder" && c.label,
  );
  assert.equal(shortcut.label, "Workspace’ler");
});
test("new workspace on Home saves a manifest and opens a session without an existing chat", async () => {
  const commands = [],
    opened = [],
    saved = [];
  const choices = ["finish", "read", "default"];
  const picks = [["/repo"], ["/saved"]];
  const ctx = {
    add: (_r, fn) => commands.push(fn()),
    sessions: { current: () => undefined },
    client: {
      rpc: () => ({
        defaults: async () => ({ directory: "/default/workspaces" }),
        createSaved: async (input) => {
          saved.push(input);
          return { manifest: "/saved/new.workspace" };
        },
        open: async () => ({ sessionID: "ses_new" }),
      }),
    },
    desktop: { pick: async () => picks.shift() },
    tabs: { open: (args) => opened.push(args) },
    dialogs: {
      prompt: async () => "New portal",
      select: async () => choices.shift(),
      confirm: async () => true,
      alert: async () => {},
    },
  };
  gui.setup(ctx);
  await commands.find((c) => c.id === "create").run();
  assert.equal(saved[0].name, "New portal");
  assert.equal(saved[0].allowFileWrites, false);
  assert.equal(saved[0].directory, undefined);
  assert.equal(picks.length, 1);
  assert.equal(opened[0].id, "ses_new");
});
