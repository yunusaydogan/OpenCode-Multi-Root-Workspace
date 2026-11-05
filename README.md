# OpenCode Multi-Root Workspace

**Multiple Git repositories. One OpenCode AI workspace.**

OpenCode Multi-Root Workspace is an open-source plugin for **OpenCode Desktop 2.2.5 / V2**.
Keep your frontend, backend, and shared libraries in separate repositories while working with
them in a single AI conversation. Each repository retains its own Git history, index, branches,
and remotes.

Create a workspace with native dialogs, choose its folders, and open it from a persistent
workspace list. **No JSON editing is required for everyday use.**

[Installation](#installation) · [Usage](#usage) · [Capabilities and limitations](#capabilities-and-limitations) · [Contributing](#contributing) · [Türkçe](README.tr.md)

> **Status:** early MVP, tested on Linux/Pardus with OpenCode Desktop 2.2.5.
> Windows installation scripts are included but have not been tested on a Windows host.
> The plugin uses an experimental Desktop GUI API. Other OpenCode versions may require changes.

## Features

- **Create without code:** enter a name, select existing Git repositories, choose access permissions,
  and save with native Desktop dialogs.
- **Persistent workspace hub:** reopen saved workspaces, import `.workspace` files, create new ones,
  or remove entries from the list without deleting files or conversations.
- **Compact access:** a folder icon in the sidebar footer with vertical tabs, or in the top toolbar
  with horizontal tabs. The label appears on hover. Available from Home as well as conversations.
- **Shared AI context:** root names and canonical repository paths are included in the conversation's
  model context. The agent can explicitly target each repository.
- **Repository-aware file tools:** list, read, create, and update text files in a named root.
- **Independent Git operations:** status, working-tree/staged diff, explicit staging, commit, and
  upstream push for one repository at a time.
- **Permission checks:** file operations respect OpenCode's read/edit rules; mutations also require
  plugin permission approval and an enabled workspace capability.
- **Repository boundary checks:** reject path traversal, escaping symlinks, Git metadata access,
  overlapping roots, and accidental access to nested repositories.
- **Read-only CLI:** inspect and validate a workspace without making a model request.
- **Git linked worktrees:** supported alongside ordinary repositories and folder names containing spaces.

## Requirements

| Requirement | Details |
| --- | --- |
| OpenCode | Desktop **2.2.5**, using the V2 `@opencode/plugin` API |
| Node.js | **22.18+**; a current LTS release is recommended |
| npm | Available in the terminal's `PATH` |
| Git | Available in the OpenCode server's `PATH` |
| Repositories | Existing local Git repositories or linked worktree roots |
| Connection | Desktop's built-in local server; the GUI workflow does not target remote servers |
| Internet | Required during installation to download npm dependencies |

OpenCode V1 plugins (`@opencode-ai/plugin`) are not supported. Linux/Pardus has been exercised;
Windows and macOS runtime behavior remains unverified. Install Node.js, npm, Git, and OpenCode
before running the installer. The scripts do not install system dependencies.

## Installation

### Linux / Pardus

Close OpenCode Desktop, then run:

```sh
git clone https://github.com/yunusaydogan/OpenCode-Multi-Root-Workspace.git
cd OpenCode-Multi-Root-Workspace
sh install.sh
```

### Windows

Close OpenCode Desktop. In Command Prompt:

```bat
git clone https://github.com/yunusaydogan/OpenCode-Multi-Root-Workspace.git
cd OpenCode-Multi-Root-Workspace
install.bat
```

Alternatively, download the repository with **Code → Download ZIP**, extract the entire archive,
and run the installer inside it. On Windows, you can double-click `install.bat`.
Keep the `scripts` folder beside the installer; the wrapper is not a standalone download.

### What the installer does

1. Checks Node.js, npm, and Git.
2. Prepares a separate copy, installs dependencies, and checks/builds a source distribution.
3. Installs a standalone copy into OpenCode's automatically discovered global plugin directory.
4. Backs up an existing installation before replacing it.

No administrator or `sudo` access is required. Existing OpenCode JSON/JSONC settings and the
source checkout are preserved. OpenCode detects the installed directory automatically:
**do not also add the same plugin to your `plugins` configuration array.**

The installer determines the OpenCode configuration directory in this order:

1. `OPENCODE_CONFIG_DIR`, when set.
2. `XDG_CONFIG_HOME/opencode`, when set.
3. `~/.config/opencode` — on Windows, normally `%USERPROFILE%\.config\opencode`.

The installed plugin is placed at:

```text
<opencode-config>/plugins/opencode-multi-root-workspace/
```

For a custom configuration directory:

```sh
sh install.sh --config-dir "/custom/opencode"
```

```bat
install.bat --config-dir "D:\OpenCode Config"
```

OpenCode Desktop must use that same configuration directory. Restart Desktop after installation.
Under **Settings → Extensions → Plugins**, look for `multi-root-workspace` if you need to check
whether the plugin loaded.

### Update

Close Desktop, enter your original checkout, and run:

```sh
git pull --ff-only
sh install.sh
```

On Windows, run `install.bat` after `git pull --ff-only` instead.
Backups are stored as `.multi-root-backup-*` directories inside the OpenCode configuration directory.
Restart Desktop after updating. To restore a backup, close Desktop, move the current plugin
folder aside, and move the chosen backup back to the installed plugin path.

### Uninstall

Close Desktop and remove only `<opencode-config>/plugins/opencode-multi-root-workspace`.
If you used the manual method below, also remove its explicit configuration entry.
Workspace manifests, repositories, and conversation data are not deleted by removing the plugin.

### Manual installation alternative

Use this method **instead of** the installer. In a source checkout:

```sh
npm ci
npm run check
```

Add the checkout's real absolute path to your global `opencode.jsonc`, preserving existing settings:

```json
{
  "plugins": ["/absolute/path/OpenCode-Multi-Root-Workspace"]
}
```

V2 uses **`plugins`**, plural. Keep this checkout at the configured path and rebuild after updates.
The GUI bundle in `dist/` is generated; a plain Git checkout must be built before Desktop can load it.
There is **no npm release advertised by this repository**. Source installation is the supported path.

## Usage

### Create your first workspace

1. Open Desktop and find the small **folder icon**. Hover to see **Workspace’ler** (Workspaces).
2. Choose **Yeni Workspace** (New workspace) and enter a name.
3. Select your frontend/backend repository folders. Use **Başka klasör ekle** (Add another folder)
   to select repositories from different locations, then choose **Devam et** (Continue).
4. Choose the access level: read-only, file editing, or file editing plus Git mutations.
5. Choose **Varsayılan konuma kaydet** (Save to default location), or choose a custom save folder.
6. Review the summary and click **Oluştur ve aç** (Create and open).

The plugin writes the manifest and opens a **new local conversation** with the workspace attached.
It does not depend on the current conversation's project directory. The success message shows
the exact file path. Default manifests are saved under:

```text
<opencode-config>/workspaces/workspace-<name>.workspace
```

Creating a workspace does not initialize repositories, clone them, or move their files.
Select each repository's actual Git root. Root names are derived from folder names; use
`workspace_info` to see the resulting names.

**The current GUI labels are Turkish.** This README includes their English meanings;
full GUI localization is not implemented yet.

### Reopen, import, or remove a workspace

Open the folder-icon hub to see up to **200 saved entries**:

| Action | Result |
| --- | --- |
| Select a saved workspace | Opens a new conversation with that workspace |
| **Mevcut workspace ekle** — Add existing workspace | Selects an existing `.workspace` file, registers it, and opens it |
| **Yeni Workspace** — New workspace | Starts the creation wizard |
| **Listeden workspace kaldır** — Remove from list | Forgets the entry; preserves the manifest, repositories, and conversations |

The list persists across conversations. Previous session selections are imported into the catalog
when possible. Missing manifests or repositories are marked as unavailable. Manifests created
outside the plugin need to be imported; the plugin does not scan your computer for workspace files.

The command palette also provides **Workspace’ler**, **Multi-Root Workspace: Yeni Workspace**,
**Open .workspace**, **Status**, and **Clear selection**. The last three operate on an existing local
conversation. **Clear selection** clears its attachment, not the catalog entry. New/forked/subagent
conversations do not automatically inherit a selection.

### Work with the AI

Start by asking the agent to inspect the selected roots and their instructions:

> Use workspace_info. List every repository root and read each root's AGENTS.md if present.
> Compare the frontend API calls with the backend endpoints. Show each repo's Git status separately.

For a file change:

> Use workspace_files to read the frontend API client. Explain the change, then update it after approval.

For a repository-specific commit:

> Show the backend's staged diff. After my approval, commit the staged changes with the message
> "Fix personnel endpoint". Do not stage additional files. Ask separately before pushing.

Use the root names reported by `workspace_info`; they may differ from the example names above.

## Tools and Git behavior

| Tool | Operations | Scope |
| --- | --- | --- |
| `workspace_info` | Workspace name, manifest, roots, and capabilities | Current conversation |
| `workspace_files` | `list`, `read`, `write` | One explicit root |
| `workspace_git` | `status`, `diff`, `stage`, `commit`, `push` | One explicit root |

Important operation details:

- **Read/write:** UTF-8 text files up to **256 KiB**. Updates require the exact old text in `expected`;
  a new file uses `expected: null`. Parent directories must already exist. Binary files, deletion,
  and renaming are not supported. The expected-content check is not an atomic cross-process transaction.
- **Listing:** up to **1,000 regular files**, using tracked and non-ignored untracked Git files.
  Deleted files, submodules, and escaping links are omitted. A truncation indicator is returned.
  Explicit reads can access ignored files when permissions allow.
- **Diff:** working-tree diff by default; `staged: true` inspects the index. Untracked contents
  are not included in Git diff output.
- **Stage:** explicit file paths, including deleted files. No implicit `git add .`, directories,
  or wildcard pathspec expansion.
- **Commit:** includes **all currently staged changes in the chosen repository**. It never
  implicitly stages files. The approval metadata includes the staged diff.
- **Push:** requires the current branch's named remote upstream. Pushes `HEAD` to that branch
  without force, automatic tag publication, or recursive submodule pushes.

There is no transaction across repositories. Initial upstream setup, branching, fetch/pull,
merge/rebase, conflict resolution, and rollback remain normal Git tasks. Git still uses your
configured hooks, signing, filters, and transports. Commands time out after **30 seconds** and
reject output above **2 MiB**. A timed-out push may have reached the remote; inspect before retrying.

## Workspace manifest reference

You can inspect or edit a manifest manually, but the GUI creates it for you.

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

| Field | Meaning |
| --- | --- |
| `version` | Required; currently `1` |
| `name` | Required display name, 1–120 characters |
| `roots` | 1–32 named Git roots; paths resolve relative to the manifest |
| `allowFileWrites` | Enables the file-write capability; defaults to `false` |
| `allowGitWrites` | Enables stage/commit/push capability; defaults to `false` |

Absolute root paths are accepted. Root names must be unique and use letters, digits, `_`, or `-`
(up to 64 characters). Duplicate/overlapping canonical roots are rejected, including different paths or symlinks
resolving to the same root. Different
linked worktrees of one repository are allowed and retain Git's usual shared refs/configuration.

Use strict JSON: this is not JSONC or VS Code's `.code-workspace` format. `~` and environment
variables are not expanded. Manifests are validated on use, and the creator never overwrites
an existing file. See the [example](examples/personnel-portal.workspace) and
[JSON schema](examples/workspace.schema.json).

An optional plugin `options.manifest` can provide a global fallback. It applies to every unselected
conversation, including after Clear; omit it if you want selection to be strictly per conversation.

## Permissions and data handling

Capability flags do not bypass OpenCode permissions. File tools check standard `read`/`edit`
and applicable external-directory rules, plus `workspace_read` or `workspace_write`.
Git tools check external-directory rules and `workspace_git_read` or `workspace_git_write`.
A plugin hook changes allowed mutations into `ask`, while preserving denials, including plan-mode
edit restrictions. An agent's `confirmed: true` field is not itself user consent.

Optional global rules for routine inspection:

```json
{
  "permissions": [
    { "action": "workspace_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_git_read", "resource": "*", "effect": "allow" },
    { "action": "workspace_write", "resource": "*", "effect": "ask" },
    { "action": "workspace_git_write", "resource": "*", "effect": "ask" }
  ]
}
```

Merge these into your existing V2 configuration if desired. OpenCode's saved approvals,
unattended policies, and built-in shell permissions still apply.

The plugin adds no telemetry and stores no Git or model credentials. It stores workspace paths,
metadata, and conversation attachments in plugin storage, and manifests where you choose to save
them. Root metadata enters the AI context; requested file contents can be sent to your selected
model through OpenCode. Use trusted repositories and review what you share.

GUI/RPC operations are authenticated client actions, not AI tools. Creating/saving a manifest,
opening a conversation, and managing the catalog use that client authority. A GUI confirmation
is not a separate RPC authorization boundary. This plugin is not a sandbox against hostile
repositories, Git hooks, or concurrent filesystem/symlink attacks.

## Capabilities and limitations

This plugin provides a **logical multi-repository AI workspace**. It does not replace OpenCode's
native single-location project model.

| Capability | Supported? |
| --- | --- |
| Create, save, import, list, and open workspaces | Yes |
| AI file access and independent Git operations across roots | Yes, through plugin tools |
| Place a workspace section directly beneath native Home/Projects | No public contribution point in the inspected 2.2.5 SDK |
| Turn the native explorer/search/LSP/watchers into multi-root services | No |
| Aggregate every repo into the native Git/diff UI | No; use workspace tools or Status |
| Include custom file writes in native OpenCode undo | **No** |
| Automatically load every extra root's AGENTS.md or project plugins/config | No; read repo instructions explicitly |
| Clone repositories or create branches/remotes | No |
| Remote-server Desktop workflow | Not supported by this GUI release |
| English GUI | Not yet; current labels are Turkish |

The compact shortcut uses the official `TitlebarItem` API rather than modifying the app's DOM.
Native tools keep their normal project scope. Use Git and reviewed backups to recover custom
file changes; **do not rely on native undo for `workspace_files` writes**.

See [compatibility and upstream evidence](docs/compatibility.md) and
[validation notes](docs/validation.md) for the tested API contract and practical limits.

## Troubleshooting

**The folder icon is missing**

- Restart Desktop after installation and check **Settings → Extensions → Plugins**.
- With vertical tabs, look in the sidebar footer; with horizontal tabs, look in the top toolbar.
- Check Node/Git availability, installation output, and that Desktop uses the expected config directory.
- Avoid installing both a discovered copy and an explicit `plugins` entry for the same plugin.

**The workspace is not in the list**

Import its `.workspace` file with **Mevcut workspace ekle**. A catalog entry is separate from the
file itself. Removing an entry does not delete the manifest. A missing-file label means the
manifest or one of its repositories moved or is unavailable.

**Creation fails or no file appears**

Finish with **Oluştur ve aç**; picking repository folders alone does not create a file.
Use the default save option unless you need another location. Check that every selected folder
is a Git root, the destination is writable, and a manifest with that name does not already exist.
The success message shows the exact path. If saving succeeds but opening fails, the message
identifies the saved file so you can reopen it from the hub.

**Stage/commit/push is disabled**

Choose a workspace capability that permits Git mutations, or update its manifest. OpenCode
permissions still apply. Configure an upstream with normal Git before using the push tool.

**Desktop reports “Data migration failed” or loads indefinitely**

Check OpenCode's own service/connection logs before assuming workspace data is damaged.
A Desktop authentication issue with non-loopback local-service addresses has been
[reported upstream](https://github.com/anomalyco/opencode/issues/51075).
For a local-only setup, inspect the service address and any separately saved obsolete server
connection. Changing a listener to `127.0.0.1` disables direct LAN access, so only do that if it
matches your intended setup. The installer does not change network settings or reset your data.

## CLI

The optional helper exposes read-only operations:

```sh
node src/cli.mjs validate /path/portal.workspace
node src/cli.mjs info /path/portal.workspace
node src/cli.mjs status /path/portal.workspace
node src/cli.mjs diff /path/portal.workspace backend
node src/cli.mjs list /path/portal.workspace frontend
node src/cli.mjs read /path/portal.workspace backend AGENTS.md
```

## Development and testing

```sh
npm ci
npm run check
```

`check` runs TypeScript validation, the Node test suite, and the official GUI bundle build.
The current suite has **23 tests**, including real temporary Git repositories, a local bare
remote, file boundaries, session permissions, installer backups, catalog persistence,
and the stale-project-directory creation regression.

An optional integration test starts an isolated real OpenCode server without a model API key:

```sh
OPENCODE_BIN=/path/to/opencode npm run test:live
```

PowerShell equivalent:

```powershell
$env:OPENCODE_BIN = "C:\path\to\opencode.exe"
npm run test:live
```

The integration test verifies RPC creation, automatic file saving, opening sessions across
locations, catalog operations, and GUI bundle delivery. It does not automate native Desktop
clicks. Linux Desktop startup, the shortcut's visibility, and successful workspace creation
have also been confirmed through user testing. Windows execution remains unverified.

GitHub Actions is configured to check Node 22 and 24 on Ubuntu and retain a package artifact.
For a local distributable:

```sh
npm pack
```

The tarball contains the built GUI; the source ZIP/Git checkout requires a build. Publishing on
GitHub does not publish to npm. See the [release checklist](docs/publishing.md).

Run `npm audit` before releases. The tested OpenCode 2.2.5 SDK dependency tree has known moderate
findings documented in the validation notes; do not force-upgrade the SDK without checking API compatibility.

## Contributing

Issues and focused pull requests are welcome. For a bug report, include:

- OpenCode/plugin versions and operating system.
- The action you attempted and expected versus actual behavior.
- A minimal manifest or repository layout with private paths removed.
- Relevant, redacted error messages — never credentials, tokens, or private source files.

For code changes, add a regression test where appropriate, run `npm run check`, and keep the
per-repository boundaries and documented API limitations intact. Test Windows changes on Windows.
For security-sensitive reports, contact the [maintainer](https://github.com/yunusaydogan)
privately rather than posting sensitive details in a public issue.

## License and acknowledgments

Released under the [MIT License](LICENSE). Maintained by [yunusaydogan](https://github.com/yunusaydogan)
and contributors.

Built for [OpenCode](https://github.com/anomalyco/opencode) using its
[V2 plugin API](https://opencode.ai/v2/docs/build/plugins). This is an independent community project,
not an official OpenCode product.
