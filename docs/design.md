# Design and execution plan

Authorized scope: open-source MVP for Linux/Pardus and installed OpenCode Desktop 2.2.5.

Use V2 server tools, session context hooks, scoped RPC and an experimental GUI command.
Alternative: a V1 server-only plugin would miss the installed GUI API. A core fork could
replace project/explorer/snapshot behavior but would cease to be an independently installable plugin.

Selection belongs to a session, persists via plugin storage, and is validated on every use.
Explicit root names map to canonical, distinct, non-overlapping Git worktree roots. No merged Git index.
Read/list/write and fixed Git operations use argument arrays, bounded output and cancellation.
Writes require explicit manifest capability and server permission checks. Commit uses the existing
index, never implicitly stages. Push targets only the current branch's configured upstream.

Implementation sequence:
- [x] Write real-repository integration tests for manifests, file confinement, Git isolation and push.
- [x] Run tests before implementing the core; add core manifest/file/Git modules and rerun.
- [x] Register V2 tools, context hook and session-scoped RPC; test adapters and typecheck against 2.2.5.
- [x] Build GUI command with native manifest selection and status view; verify bundle and package install.
- [x] Add English/Turkish docs, example, JSON schema, MIT license, CI and publication instructions.
- [x] Run all checks, inspect distributable, create local Git commit and prepare the public publication approval request.

Native project picker, explorer, project identity and undo remain owned by OpenCode.
GUI command is an additional entry point in an already-created local session. No native multi-root claims.
