import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { configDirectory, installPrepared } from "../scripts/install.mjs";
test("installer honors OpenCode and XDG config overrides on both platforms", () => {
  assert.equal(
    configDirectory({ OPENCODE_CONFIG_DIR: "/custom" }, "/home/test"),
    "/custom",
  );
  assert.equal(
    configDirectory({ XDG_CONFIG_HOME: "/xdg" }, "/home/test"),
    join("/xdg", "opencode"),
  );
  assert.equal(
    configDirectory({}, "/home/test"),
    join("/home/test", ".config", "opencode"),
  );
});
test("installs built package via automatic plugin discovery, preserving settings and backing up updates", async (t) => {
  const base = await mkdtemp(join(tmpdir(), "workspace-install-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  const config = join(base, "config with spaces");
  await mkdir(config);
  const settings = '// my settings\n{"theme":"dark"}\n';
  await writeFile(join(config, "opencode.jsonc"), settings);
  const makeStage = async (name, text) => {
    const stage = join(base, name);
    await mkdir(stage);
    await writeFile(
      join(stage, "package.json"),
      JSON.stringify({
        name: "opencode-multi-root-workspace",
        exports: {
          ".": "./src/index.ts",
          "./gui-experimental": "./dist/gui-experimental.cjs",
        },
      }),
    );
    await writeFile(join(stage, "marker"), text);
    return stage;
  };
  const first = await installPrepared(await makeStage("first", "one"), config);
  assert.equal(await readFile(join(first.target, "marker"), "utf8"), "one");
  assert.equal(first.backup, undefined);
  const second = await installPrepared(
    await makeStage("second", "two"),
    config,
  );
  assert.equal(await readFile(join(second.target, "marker"), "utf8"), "two");
  assert.equal(await readFile(join(second.backup, "marker"), "utf8"), "one");
  assert.equal(
    await readFile(join(config, "opencode.jsonc"), "utf8"),
    settings,
  );
});
