# OpenCode Multi-Root Workspace

An MIT-licensed MVP for **OpenCode Desktop 2.2.5 / V2**, developed and tested on Linux/Pardus.
Select a `.workspace` manifest from an additional Desktop command and work with separate
frontend/backend Git repositories in one AI session. Each repository keeps its own index,
branches and upstream. No monorepo conversion or symlinking of repositories.

[Türkçe kurulum ve kullanım](README.tr.md) · [API evidence and limitations](docs/compatibility.md)

## What works

- Desktop command palette: **Multi-Root Workspace: Open .workspace**, **Status**, **Clear selection**.
- Native file picker; selection persists per existing session through plugin storage.
- Repository names and canonical paths injected into the AI context on each model request.
- `workspace_info`; `workspace_files` list/read/write; `workspace_git` status/diff/stage/commit/push.
- Read-only CLI for validating manifests and inspecting repositories without an AI subscription.
- Independent repo operations, spaces in paths, and Git linked worktrees.

This is a session-level logical workspace, not a replacement for OpenCode's native project model.
The native project chooser still selects a **directory**. The built-in explorer, LSP, search,
file watcher, diffs and undo are not converted into multi-root services. A GUI command is
implemented; a custom explorer panel is not. See the [capability matrix](docs/compatibility.md).

## Requirements

- OpenCode Desktop **2.2.5**. V1 (`@opencode-ai/plugin`) is not supported.
- Git on the OpenCode server's PATH. Node **22.18+** and npm to build/check the plugin and use the CLI.
- Existing local session on Desktop's built-in server. Remote servers and draft tabs are rejected by the picker.
- Trusted repositories and manifest. Only Linux/Pardus was exercised; Windows/macOS are unverified.

## Install from source

Download/extract this repository, enter its directory, then:

```sh
npm ci
npm run check
```

Merge the following into `~/.config/opencode/opencode.jsonc` (respect `XDG_CONFIG_HOME` if set).
Replace the sample absolute path with this checkout's real absolute path. Keep your existing settings.
**V2 uses `plugins` (plural).**

```json
{
  "plugins": ["/absolute/path/opencode-multi-root-workspace"],
  "permissions": [
    { "action": "workspace_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_git_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_write", "resource": "*", "effect": "ask" },
    { "action": "workspace_git_write", "resource": "*", "effect": "ask" }
  ]
}
```

Restart Desktop after initial installation. Under **Settings > Extensions > Plugins**, check
that `multi-root-workspace` loads. Open a directory and create/send a first message so that a
real session exists. Open the command palette, run **Multi-Root Workspace: Open .workspace**,
and select your manifest. The confirmation shows canonical repository paths and capabilities.
Use **Status** to inspect all configured repos. **Clear selection** affects only the current session.
Switching sessions while the picker is open cancels selection. New/forked/subagent sessions do
not inherit a selection automatically.

There is no npm release yet. The package name is a proposed name, not an installation claim.
A GitHub checkout requires `npm ci && npm run build`; `dist/` is generated, not committed.
To distribute a prebuilt archive run `npm pack`: the tarball includes the GUI bundle.
Do not configure an unbuilt Git checkout as a Desktop GUI plugin.

## Workspace manifest

Example layout (all repo directories already exist):

```text
projects/
  personnel-portal.workspace
  personnel-frontend/.git/
  personnel-backend/.git/
```

`personnel-portal.workspace`:

```json
{
  "version": 1,
  "name": "Personnel Portal",
  "roots": [
    { "name": "frontend", "path": "./personnel-frontend" },
    { "name": "backend", "path": "./personnel-backend" }
  ],
  "allowFileWrites": false,
  "allowGitWrites": false
}
```

Paths resolve relative to the manifest, not the shell directory. Absolute paths are accepted;
`~` and environment expansion are deliberately unsupported. Use JSON, not JSONC or VS Code's
`.code-workspace` format. See [JSON schema](examples/workspace.schema.json).
Each root must be the exact top-level directory of a Git worktree. Names must be unique and
contain only letters, digits, `_` or `-`. Aliases and overlapping/nested roots are rejected.
Two different worktrees of the same underlying repo are allowed, but share refs/config as Git normally does.
The manifest is re-read and validated on every tool call; a broken manifest fails closed.

Enable `allowFileWrites` and/or `allowGitWrites` explicitly when desired. Both default to false.
A manifest enables capability; it does not bypass OpenCode permissions. A global fallback can
be set as `{"package":"/absolute/path/plugin","options":{"manifest":"/absolute/path/portal.workspace"}}`
in `plugins`. This fallback applies to every unselected session, including after Clear; omit it
for strict per-session selection.

## Ask the agent

> Use workspace_info. List the frontend and backend roots, then read their AGENTS.md files if present.
> Compare the frontend API calls with the backend endpoints. Show each repo's status separately.

> Read frontend/src/api.ts using workspace_files. Propose the change before writing it.

> Show backend's staged diff. After my confirmation, commit the staged changes with the message
> "Fix personnel endpoint". Do not stage additional files. Ask before pushing its upstream.

Tools are registered as standalone names (Code Mode disabled for these tools).

| Tool | Operations | Notes |
| --- | --- | --- |
| `workspace_info` | selected manifest/context | No file contents auto-injected |
| `workspace_files` | `list`, `read`, `write` | Explicit `root`; relative `path` for read/write |
| `workspace_git` | `status`, `diff`, `stage`, `commit`, `push` | Explicit `root`; writes require `confirmed: true` and an actual permission decision |

`write` takes `content` and exact previous text in `expected`; use `expected: null` to create.
It checks old contents before writing, does not create parent directories, rejects final symlinks
and hardlinked files, and limits text files to 256 KiB. It is not an atomic cross-process compare-and-swap.
There is no delete/rename/binary operation. Native OpenCode undo **does not cover these writes**.

`list` uses Git tracked + non-ignored untracked files and returns up to 1,000 regular files,
with a `truncated` indicator. The listing omits deleted files, escaping links and submodules.
Explicit reads can access ignored files if permissions permit. Read/edit permissions use canonical
absolute paths, including in `.env` policy checks. No extra-root AGENTS.md, LSP or search service
is auto-loaded. Read repo instructions before editing; built-in tools may still operate in the native project.

`diff` excludes untracked files; set `staged: true` for the index. `stage` accepts explicit file
paths (including deleted files), not directories or pathspec patterns. `commit` commits **all
currently staged changes** in the chosen repo and does not implicitly stage. Its approval metadata
includes the staged diff. Inspect it first. There is no cross-repository transaction or rollback.
`push` requires a configured named remote upstream and pushes `HEAD` to that branch only, without
force. Initial upstream setup, branching, fetch/pull, merge/rebase and conflicts remain manual Git tasks.
Git uses your normal hooks, signing, filters and transport configuration. Commands time out after
30 seconds and reject output above 2 MiB; an interrupted push may have reached the remote, so inspect
status before retrying. This plugin is not a sandbox for hostile repositories or concurrent symlink attacks.

## Permissions

File operations honor standard `read`/`edit` and external-directory rules **plus** the plugin's
`workspace_read`/`workspace_write` actions. Git operations honor external-directory rules and
`workspace_git_read`/`workspace_git_write`. A permission evaluation hook changes an allowed plugin
write into `ask`, never upgrades `deny`, and prevents a broad `* allow` from silently authorizing
mutations. Standard denial (including plan-mode edit denial) is preserved. Agent-provided
`confirmed: true` is not user consent. Saved approvals/unattended behavior remain controlled by OpenCode;
this MVP does not provide an independent approval UI for agent tools. The built-in shell has its own permissions.
Selecting a manifest and the explicit Desktop Status command are direct user actions and use read-only RPC;
they do not prompt for AI tool permissions. Read-only RPC is not an authorization boundary for API clients.

## CLI and development

```sh
node src/cli.mjs validate /path/portal.workspace
node src/cli.mjs status /path/portal.workspace
node src/cli.mjs diff /path/portal.workspace backend
node src/cli.mjs list /path/portal.workspace frontend
node src/cli.mjs read /path/portal.workspace backend AGENTS.md
npm run check
# Optional runtime integration check, with OpenCode 2.2.5 installed:
OPENCODE_BIN=/path/to/opencode npm run test:live
npm pack
```

The CLI intentionally exposes no writes. Tests use temporary real Git repos and a local bare
remote; no user repository or remote is mutated. Adapter tests exercise session isolation,
permission rejection, context injection, GUI cancellation and location routing. See
[validation evidence](docs/validation.md) for the real OpenCode server smoke test and remaining checks.

Contributions: start with a small issue or PR, include a regression test, and preserve per-repo
boundaries. Run `npm ci && npm run check`. No telemetry, no stored credentials. Report a security
issue privately to the maintainer rather than placing sensitive repository paths in an issue.

MIT License. Not an official OpenCode product.
