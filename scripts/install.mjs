#!/usr/bin/env node
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  lstat,
  stat,
} from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const packageName = "opencode-multi-root-workspace";
export function configDirectory(env = process.env, home = homedir()) {
  return resolve(
    env.OPENCODE_CONFIG_DIR ||
      join(env.XDG_CONFIG_HOME || join(home, ".config"), "opencode"),
  );
}
async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (e) {
    if (e.code === "ENOENT") return false;
    throw e;
  }
}
export async function installPrepared(stage, config) {
  const target = join(config, "plugins", packageName);
  const incoming = JSON.parse(
    await readFile(join(stage, "package.json"), "utf8"),
  );
  if (incoming.name !== packageName)
    throw Error("Unexpected installer package");
  let backup;
  await mkdir(dirname(target), { recursive: true });
  if (await exists(target)) {
    if ((await lstat(target)).isSymbolicLink())
      throw Error(
        "The install target is a symlink. Remove that link manually before installing.",
      );
    const existing = JSON.parse(
      await readFile(join(target, "package.json"), "utf8"),
    );
    if (existing.name !== packageName)
      throw Error(
        "Install target belongs to another package; refusing to replace it.",
      );
    backup = await mkdtemp(join(config, ".multi-root-backup-"));
    await rm(backup, { recursive: true });
    await rename(target, backup);
  }
  try {
    await rename(stage, target);
  } catch (error) {
    if (backup) await rename(backup, target);
    throw error;
  }
  return { target, backup };
}
function run(program, args, cwd) {
  // npm.cmd is a Windows batch script. Only fixed npm arguments reach cmd.exe;
  // paths are supplied separately as cwd, never interpolated into a command string.
  const windowsNpm = process.platform === "win32" && program === "npm";
  const result = spawnSync(
    windowsNpm ? process.env.ComSpec || "cmd.exe" : program,
    windowsNpm ? ["/d", "/s", "/c", `npm.cmd ${args.join(" ")}`] : args,
    { cwd, stdio: "inherit", env: process.env },
  );
  if (result.error)
    throw Error(`${program} could not start: ${result.error.message}`);
  if (result.status !== 0)
    throw Error(
      `${program} ${args.join(" ")} failed (${result.status ?? result.signal})`,
    );
}
export async function main(args = process.argv.slice(2)) {
  if (args.includes("--help")) {
    console.log(
      "Usage: install.sh / install.bat [--config-dir PATH]\nRequires Node 22.18+ or 24+, npm, Git and OpenCode Desktop 2.2.5.\nInstalls a standalone copy under the global plugins directory. Existing settings are not edited.",
    );
    return;
  }
  if (
    args.length &&
    (args.length !== 2 || args[0] !== "--config-dir" || !args[1])
  )
    throw Error("Use --config-dir PATH or no arguments.");
  const [major, minor] = process.versions.node.split(".").map(Number);
  if (major < 22 || (major === 22 && minor < 18))
    throw Error(
      "Node.js 22.18+ is required. Install a current Node LTS and try again.",
    );
  const source = dirname(dirname(fileURLToPath(import.meta.url)));
  const config = args.length ? resolve(args[1]) : configDirectory();
  const target = join(config, "plugins", packageName);
  const rel = relative(source, target);
  if (
    rel === "" ||
    (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(".." + sep))
  )
    throw Error(
      "Choose a configuration directory outside the source checkout.",
    );
  run("npm", ["--version"], source);
  run("git", ["--version"], source);
  console.log(`Preparing installation for ${config}`);
  console.log(
    "Target: OpenCode Desktop 2.2.5. Close Desktop before updating an existing installation.",
  );
  await mkdir(config, { recursive: true });
  const stage = await mkdtemp(join(config, ".multi-root-install-"));
  try {
    for (const name of [
      "src",
      "dist",
      "examples",
      "docs",
      "scripts",
      "test",
      "package.json",
      "package-lock.json",
      "tsconfig.json",
      "vite.config.ts",
      "LICENSE",
      "README.md",
      "README.tr.md",
      "install.sh",
      "install.bat",
    ]) {
      if (await exists(join(source, name)))
        await cp(join(source, name), join(stage, name), { recursive: true });
    }
    const sourcePackage = await exists(join(stage, "package-lock.json"));
    if (sourcePackage) {
      run("npm", ["ci", "--include=dev", "--ignore-scripts"], stage);
      run("npm", ["run", "check"], stage);
    } else {
      run("npm", ["install", "--omit=dev", "--ignore-scripts"], stage);
    }
    if (!(await stat(join(stage, "dist", "gui-experimental.cjs"))).isFile())
      throw Error(
        "Built Desktop GUI bundle is missing. Install from the complete source ZIP or prebuilt npm tarball.",
      );
    const result = await installPrepared(stage, config);
    console.log(`\nInstalled: ${result.target}`);
    if (result.backup)
      console.log(`Previous installation backup: ${result.backup}`);
    console.log(
      "Existing OpenCode settings were preserved. Do not also list this package in plugins config: use one installation method.",
    );
    console.log(
      "Restart OpenCode Desktop. On Home, use the Workspace'ler button to create, import or open a saved workspace.",
    );
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  main().catch((error) => {
    console.error(`Installation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
