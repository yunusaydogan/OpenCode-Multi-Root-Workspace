import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import {
  loadWorkspace,
  workspaceContext,
  fileOperation,
  gitOperation,
} from "../src/core.mjs";
const git = (cwd, ...args) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_CONFIG_SYSTEM: "/dev/null",
    },
  }).trim();
async function fixture(t, capabilities = {}) {
  const base = await mkdtemp(join(tmpdir(), "oc-workspace-"));
  t.after(() => rm(base, { recursive: true, force: true }));
  for (const name of ["front end", "backend"]) {
    const root = join(base, name);
    await mkdir(root);
    git(root, "init", "-q", "-b", "main");
    git(root, "config", "user.name", "Test");
    git(root, "config", "user.email", "test@example.invalid");
    await writeFile(join(root, "app.txt"), `${name}\n`);
    git(root, "add", ".");
    git(root, "commit", "-qm", "initial");
  }
  const manifest = join(base, "portal.workspace");
  const data = {
    version: 1,
    name: "Portal",
    roots: [
      { name: "frontend", path: "./front end" },
      { name: "backend", path: "./backend" },
    ],
    ...capabilities,
  };
  await writeFile(manifest, JSON.stringify(data));
  return {
    base,
    manifest,
    data,
    front: join(base, "front end"),
    back: join(base, "backend"),
    ws: await loadWorkspace(manifest),
  };
}
test("manifest resolves relative paths independently of cwd and context labels each repo", async (t) => {
  const f = await fixture(t);
  assert.equal(f.ws.roots[0].path, f.front);
  assert.match(workspaceContext(f.ws), /frontend/);
  assert.match(workspaceContext(f.ws), /backend/);
});
test("rejects duplicates, overlapping roots, non-root folders and malformed manifests", async (t) => {
  const f = await fixture(t);
  for (const data of [
    { ...f.data, version: 3 },
    { ...f.data, roots: [...f.data.roots, f.data.roots[0]] },
    { ...f.data, roots: [{ name: "x", path: "./front end/sub" }] },
    { ...f.data, allowGitWrites: "yes" },
  ]) {
    await mkdir(join(f.front, "sub"), { recursive: true });
    await writeFile(f.manifest, JSON.stringify(data));
    await assert.rejects(loadWorkspace(f.manifest));
  }
  git(f.front, "init", "-q", join(f.front, "nested"));
  await writeFile(
    f.manifest,
    JSON.stringify({
      ...f.data,
      roots: [
        { name: "a", path: f.front },
        { name: "b", path: join(f.front, "nested") },
      ],
    }),
  );
  await assert.rejects(loadWorkspace(f.manifest), /overlap/i);
});
test("read/list respect ignores; write is disabled by default", async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.front, ".gitignore"), "secret.txt\n");
  await writeFile(join(f.front, "secret.txt"), "secret");
  assert.equal(
    await fileOperation(f.ws, {
      op: "read",
      root: "frontend",
      path: "app.txt",
    }),
    "front end\n",
  );
  assert.ok(
    !(await fileOperation(f.ws, { op: "list", root: "frontend" })).includes(
      "secret.txt",
    ),
  );
  await assert.rejects(
    fileOperation(f.ws, {
      op: "write",
      root: "frontend",
      path: "app.txt",
      content: "x",
    }),
    /disabled/i,
  );
  await assert.rejects(
    fileOperation(f.ws, { op: "read", root: "missing", path: "app.txt" }),
    /root/i,
  );
});
test("rejects traversal, git metadata, symlink escapes and nested repository files", async (t) => {
  const f = await fixture(t, { allowFileWrites: true });
  await symlink(f.back, join(f.front, "escape"));
  git(f.front, "init", "-q", join(f.front, "nested"));
  await writeFile(join(f.front, "nested", "x"), "nested");
  for (const path of [
    "../backend/app.txt",
    ".git/config",
    "escape/app.txt",
    "nested/x",
  ]) {
    await assert.rejects(
      fileOperation(f.ws, { op: "read", root: "frontend", path }),
    );
    await assert.rejects(
      fileOperation(f.ws, {
        op: "write",
        root: "frontend",
        path,
        content: "bad",
      }),
    );
  }
  assert.equal(await readFile(join(f.back, "app.txt"), "utf8"), "backend\n");
});
test("writes require expected old content and never silently overwrite concurrent changes", async (t) => {
  const f = await fixture(t, { allowFileWrites: true });
  await assert.rejects(
    fileOperation(f.ws, {
      op: "write",
      root: "frontend",
      path: "app.txt",
      content: "new",
      expected: "wrong",
    }),
    /changed/i,
  );
  await fileOperation(f.ws, {
    op: "write",
    root: "frontend",
    path: "app.txt",
    content: "new",
    expected: "front end\n",
  });
  assert.equal(await readFile(join(f.front, "app.txt"), "utf8"), "new");
  await fileOperation(f.ws, {
    op: "write",
    root: "backend",
    path: "new.txt",
    content: "created",
    expected: null,
  });
  await assert.rejects(
    fileOperation(f.ws, {
      op: "write",
      root: "backend",
      path: "new.txt",
      content: "oops",
      expected: null,
    }),
    /exist/i,
  );
});
test("status/diff isolate repositories; stage uses literal paths; commit includes only staged changes", async (t) => {
  const f = await fixture(t, { allowGitWrites: true });
  await writeFile(join(f.front, "app.txt"), "changed\n");
  await writeFile(join(f.front, "other.txt"), "unstaged");
  assert.match(
    await gitOperation(f.ws, { op: "status", root: "frontend" }),
    /app.txt/,
  );
  assert.doesNotMatch(
    await gitOperation(f.ws, { op: "status", root: "backend" }),
    /app.txt/,
  );
  assert.match(
    await gitOperation(f.ws, { op: "diff", root: "frontend" }),
    /changed/,
  );
  await assert.rejects(
    gitOperation(f.ws, { op: "stage", root: "frontend", paths: ["app.txt"] }),
    /confirm/i,
  );
  await gitOperation(f.ws, {
    op: "stage",
    root: "frontend",
    paths: ["app.txt"],
    confirmed: true,
  });
  assert.match(
    await gitOperation(f.ws, { op: "diff", root: "frontend", staged: true }),
    /changed/,
  );
  await gitOperation(f.ws, {
    op: "commit",
    root: "frontend",
    message: "frontend only",
    confirmed: true,
  });
  assert.equal(git(f.front, "log", "-1", "--format=%s"), "frontend only");
  assert.equal(git(f.back, "log", "-1", "--format=%s"), "initial");
  assert.match(git(f.front, "status", "--porcelain"), /other.txt/);
  await writeFile(join(f.front, ":(glob)*"), "literal");
  await gitOperation(f.ws, {
    op: "stage",
    root: "frontend",
    paths: [":(glob)*"],
    confirmed: true,
  });
  assert.equal(git(f.front, "diff", "--cached", "--name-only"), ":(glob)*");
});
test("git writes require manifest capability and push only updates configured upstream", async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    gitOperation(f.ws, {
      op: "commit",
      root: "frontend",
      confirmed: true,
      message: "x",
    }),
    /disabled/i,
  );
  const ws = { ...f.ws, allowGitWrites: true };
  await assert.rejects(
    gitOperation(ws, { op: "push", root: "frontend", confirmed: true }),
    /upstream/i,
  );
  const remote = join(f.base, "remote.git");
  git(f.base, "init", "-q", "--bare", remote);
  git(f.front, "remote", "add", "origin", remote);
  git(f.front, "push", "-qu", "origin", "main");
  await writeFile(join(f.front, "app.txt"), "push me");
  git(f.front, "add", ".");
  git(f.front, "commit", "-qm", "pushed");
  git(f.front, "config", "push.followTags", "true");
  git(f.front, "tag", "-am", "must remain local", "local-only");
  await gitOperation(ws, { op: "push", root: "frontend", confirmed: true });
  assert.equal(git(f.base, "--git-dir", remote, "tag", "--list"), "");
  assert.equal(
    git(f.base, "--git-dir", remote, "rev-parse", "refs/heads/main"),
    git(f.front, "rev-parse", "HEAD"),
  );
});
test("Git linked worktrees are allowed, but directory aliases are rejected", async (t) => {
  const f = await fixture(t);
  const linked = join(f.base, "linked");
  git(f.front, "worktree", "add", "-qb", "feature", linked);
  await symlink(f.front, join(f.base, "alias"));
  await writeFile(
    f.manifest,
    JSON.stringify({
      ...f.data,
      roots: [
        { name: "linked", path: linked },
        { name: "back", path: f.back },
      ],
    }),
  );
  assert.equal((await loadWorkspace(f.manifest)).roots[0].path, linked);
  await writeFile(
    f.manifest,
    JSON.stringify({
      ...f.data,
      roots: [
        { name: "one", path: f.front },
        { name: "alias", path: join(f.base, "alias") },
      ],
    }),
  );
  await assert.rejects(loadWorkspace(f.manifest), /overlap|duplicate/i);
});
test("final-component symlinks into nested repositories cannot bypass the root boundary", async (t) => {
  const f = await fixture(t);
  const nested = join(f.front, "nested");
  git(f.front, "init", "-q", nested);
  await writeFile(join(nested, "secret.txt"), "nested");
  await symlink(join(nested, "secret.txt"), join(f.front, "alias.txt"));
  await assert.rejects(
    fileOperation(f.ws, { op: "read", root: "frontend", path: "alias.txt" }),
    /Nested/,
  );
});
test("staging a directory never implicitly stages its descendants", async (t) => {
  const f = await fixture(t, { allowGitWrites: true });
  await mkdir(join(f.front, "sub"));
  await writeFile(join(f.front, "sub", "x"), "x");
  await assert.rejects(
    gitOperation(f.ws, {
      op: "stage",
      root: "frontend",
      paths: ["sub"],
      confirmed: true,
    }),
    /file/i,
  );
});
test("workspace creator validates selected repos and never overwrites a manifest", async (t) => {
  const { createWorkspace } = await import("../src/core.mjs");
  const f = await fixture(t);
  const ws = await createWorkspace({
    name: "Personel Portalı",
    directory: f.base,
    folders: [f.front, f.back],
    allowFileWrites: true,
    allowGitWrites: false,
  });
  assert.equal(ws.name, "Personel Portalı");
  assert.equal(ws.roots.length, 2);
  assert.equal(ws.allowFileWrites, true);
  assert.equal((await loadWorkspace(ws.manifest)).roots[0].path, f.front);
  await assert.rejects(
    createWorkspace({
      name: "Personel Portalı",
      directory: f.base,
      folders: [f.front, f.back],
    }),
    /exist/i,
  );
  await assert.rejects(
    createWorkspace({ name: "invalid", directory: f.base, folders: [f.base] }),
  );
  await assert.rejects(readFile(join(f.base, "workspace-invalid.workspace")));
});
test("default workspace directory follows the OpenCode config location", async () => {
  const { savedWorkspaceDirectory } = await import("../src/core.mjs");
  assert.equal(
    savedWorkspaceDirectory({ OPENCODE_CONFIG_DIR: "/custom" }, "/home/test"),
    join("/custom", "workspaces"),
  );
  assert.equal(
    savedWorkspaceDirectory({ XDG_CONFIG_HOME: "/xdg" }, "/home/test"),
    join("/xdg", "opencode", "workspaces"),
  );
});
