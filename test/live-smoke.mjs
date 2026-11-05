// Optional: requires an installed OpenCode 2.2.5 binary, never an LLM API key.
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { OpenCode } from "@opencode/client/promise";
import { WorkspaceRpc } from "../src/rpc.ts";
const binary = process.env.OPENCODE_BIN;
if (!binary) throw Error("Set OPENCODE_BIN to an OpenCode 2.2.5 executable");
const pluginDir = resolve(
  process.env.WORKSPACE_PLUGIN_DIR ??
    dirname(dirname(fileURLToPath(import.meta.url))),
);
const base = await mkdtemp(join(tmpdir(), "oc-live-"));
const config = process.env.WORKSPACE_SMOKE_CONFIG_DIR
  ? resolve(process.env.WORKSPACE_SMOKE_CONFIG_DIR)
  : join(base, "config");
if (!process.env.WORKSPACE_SMOKE_CONFIG_DIR) {
  await mkdir(config);
  await writeFile(
    join(config, "opencode.json"),
    JSON.stringify({ plugins: [pluginDir] }),
  );
}
const env = {
  ...process.env,
  OPENCODE_CONFIG_DIR: config,
  OPENCODE_CONFIG_CONTENT: "{}",
  OPENCODE_DB: join(base, "db.sqlite"),
  XDG_CONFIG_HOME: join(base, "xdg-config"),
  XDG_DATA_HOME: join(base, "data"),
  XDG_CACHE_HOME: join(base, "cache"),
  XDG_STATE_HOME: join(base, "state"),
  OPENCODE_DISABLE_FILEWATCHER: "true",
  OPENCODE_DISABLE_MODELS_FETCH: "true",
};
delete env.OPENCODE_CONFIG;
delete env.OPENCODE_SERVER_PASSWORD;
const child = spawn(
  binary,
  ["serve", "--hostname", "127.0.0.1", "--port", "0"],
  { cwd: base, env, stdio: ["ignore", "pipe", "pipe"] },
);
let output = "",
  errors = "";
child.stdout.on("data", (b) => (output += b));
child.stderr.on("data", (b) => (errors += b));
try {
  const deadline = Date.now() + 20000;
  let url, password;
  while (Date.now() < deadline) {
    url = output.match(/server listening on (http:\/\/[^\s]+)/)?.[1];
    password = output.match(/server password ([^\s]+)/)?.[1];
    if (url && password) break;
    if (child.exitCode !== null)
      throw Error("Server exited: " + errors.slice(-1200));
    await delay(50);
  }
  assert.ok(url && password, "Server startup timeout");
  const client = OpenCode.make({
    baseUrl: url,
    headers: {
      Authorization:
        "Basic " + Buffer.from("opencode:" + password).toString("base64"),
    },
  });
  const repo = join(base, "repo");
  await mkdir(repo);
  execFileSync("git", ["init", "-q", "-b", "main", repo]);
  await writeFile(join(repo, "hello.txt"), "live");
  const manifest = join(base, "demo.workspace");
  await writeFile(
    manifest,
    JSON.stringify({
      version: 1,
      name: "Smoke workspace",
      roots: [{ name: "app", path: "repo" }],
    }),
  );
  const location = { directory: repo };
  const session = await client.session.create({
    location,
    title: "Plugin smoke",
  });
  assert.match(
    await client
      .rpc(WorkspaceRpc)
      .select({ sessionID: session.id, manifest }, { location }),
    /Smoke workspace/,
  );
  assert.match(
    await client
      .rpc(WorkspaceRpc)
      .status({ sessionID: session.id }, { location }),
    /hello.txt/,
  );
  const plugins = await client.plugin.list({ location });
  assert.ok(
    JSON.stringify(plugins).includes("multi-root-workspace"),
    "Plugin missing from runtime registry",
  );
  const gui = await client.plugin.gui({ id: "multi-root-workspace", location });
  assert.ok(JSON.stringify(gui).length > 1000, "GUI bundle missing");
  const created = await client
    .rpc(WorkspaceRpc)
    .create(
      {
        sessionID: session.id,
        name: "Created smoke",
        directory: base,
        folders: [repo],
        allowFileWrites: false,
        allowGitWrites: false,
      },
      { location },
    );
  assert.match(created, /Created smoke/);
  assert.match(
    await client
      .rpc(WorkspaceRpc)
      .status({ sessionID: session.id }, { location }),
    /Created smoke/,
  );
  await client.rpc(WorkspaceRpc).clear({ sessionID: session.id }, { location });
  await assert.rejects(
    client.rpc(WorkspaceRpc).status({ sessionID: session.id }, { location }),
  );
  await client.session.remove({ sessionID: session.id });
  console.log(
    "PASS: real OpenCode server loaded plugin, persisted per-session manifest, ran status, served GUI bundle, created a workspace and cleared selection.",
  );
} finally {
  child.kill("SIGTERM");
  await Promise.race([new Promise((r) => child.once("exit", r)), delay(4000)]);
  if (child.exitCode === null) child.kill("SIGKILL");
  await rm(base, { recursive: true, force: true });
}
