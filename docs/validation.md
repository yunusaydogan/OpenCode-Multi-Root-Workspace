# Validation evidence

Environment: Linux/Pardus, Git 2.47.3, Node 24.16.0, installed OpenCode CLI/Desktop sidecar 2.2.5.
Date: 2026-11-05. See package-lock.json for exact dependency resolutions.

Executed checks:
- TypeScript checks against the **published `@opencode/plugin@2.2.5`**, not hand-written SDK stubs.
- Real temporary Git repositories: manifest validation, path resolution, linked worktrees,
  aliases, overlapping roots, nested repositories, traversal, escaping symlinks, `.git` paths,
  ignored file listing, optimistic expected-content writes, root-specific status/diff/stage/commit,
  literal pathspec characters, disabled capabilities, and push to a local bare upstream.
- Host adapter tests: separate session selections, clear, invalid manifests, permission denial,
  context hook payload, cleanup, native-picker cancellation/session switching/location routing,
  and write permission guard preserving deny.
- Vite build via the official `@opencode/plugin/gui/vite` bundler; CommonJS GUI export produced.
- A **separate isolated real OpenCode 2.2.5 server**, with its own config/database/data directories:
  plugin RPC selected a manifest, queried a real repo's status, cleared selection, and the server
  returned the built GUI bundle. This also passed with a separately extracted and installed
  npm tarball, not only the source checkout. No model-provider call or user repository mutation was needed.

The test suite's host adapter is a small harness, not a full OpenCode runtime. The isolated server
smoke test supplies a separate integration check. Actual Desktop window clicks/native file dialog
and an end-to-end LLM tool invocation remain manual acceptance checks. Existing Desktop config
was not modified. Windows, macOS, remote servers, npm publication and GitHub-hosted CI have not
been verified here. This is an MVP, not a claim of production parity with native multi-root IDEs.

## Dependency audit

An initial audit found a high-severity Zod advisory; the direct dependency was upgraded to
`zod@4.6.7`, removing that high-severity finding. The subsequent npm audit still reported
**24 moderate findings** in the pinned OpenCode SDK dependency tree; no compatible automatic
fix was reported for `@opencode/plugin@2.2.5`. Do not use `npm audit fix --force` to silently
replace the tested API. Re-run `npm audit` before a release; the registry can change after this record.

## Manual Desktop acceptance

1. Build and globally configure this plugin per README; restart Desktop 2.2.5.
2. Open an ordinary local project and send a first message to create a session.
3. Select the example manifest after adapting its paths; verify both canonical paths in the result.
4. Ask workspace_info and each root's file list/status. Switch sessions: no inherited selection.
5. Enable file writes in a disposable manifest; reject a write request and verify no file changed.
6. Accept a small edit; verify its repo only changed. Native undo is not expected to revert it.
7. In a disposable repo with a local bare remote, review staged diff; approve stage/commit/push
   separately. Verify the other repo and unrelated upstream branches stay unchanged.

Final automated result: **19/19 tests passed**, TypeScript check passed, GUI build passed,
source and packed-artifact live-server smoke tests passed. Reproduce the live check with:

```sh
OPENCODE_BIN=/path/to/opencode npm run test:live
# Optionally test a separately extracted/installed package:
WORKSPACE_PLUGIN_DIR=/path/to/extracted/package OPENCODE_BIN=/path/to/opencode npm run test:live
```

A separate review identified `push.followTags` / submodule-push leakage. The fix disables
both for workspace pushes; a real-Git regression verifies an annotated local tag stays local.

## Platform installers

Added `install.sh`, `install.bat` and shared `scripts/install.mjs`. The Linux script was run
end-to-end against a temporary config path containing spaces. Source dependencies, the full
check/build and staged installation passed. Installer tests verify config path precedence,
preservation of existing JSONC text and backup of an existing installation. Windows command
execution has not been exercised on a Windows host. The scripts require Node/npm/Git already
installed and do not install system dependencies or alter the real user's OpenCode config.

The installed Linux copy was also loaded by a real isolated OpenCode 2.2.5 server through
automatic global plugin discovery, without adding a `plugins` configuration entry. Manifest
selection, status, GUI bundle delivery and clearing selection passed.

## Workspace creation wizard

Added the side-panel + menu entry and palette command for native, code-free workspace creation.
Tests cover name/folder/capability/destination submission, cancellation, validation before writing,
and refusal to overwrite an existing manifest. The real server smoke now also calls create RPC,
then verifies the newly created workspace is active. Native Desktop dialog clicks remain a manual
acceptance check; the wizard adapter is exercised through the host harness.
