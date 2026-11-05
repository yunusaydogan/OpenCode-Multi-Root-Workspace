# Compatibility and upstream evidence

Verified **2026-11-05**, targeting the locally installed OpenCode **v2.2.5** and npm
`@opencode/plugin@2.2.5`. The repository's `dev` branch at inspection was
[`893e8dc43f05e872d4cac603486ce8a7181170fa`](https://github.com/anomalyco/opencode/tree/893e8dc43f05e872d4cac603486ce8a7181170fa).
Dev source is evidence, not a promise about other releases. Compile/typecheck uses the published SDK.

## Capability matrix

| Requested capability | Public API evidence / result | MVP |
| --- | --- | --- |
| Server tools and AI context | `ctx.tool.transform`, `ctx.session.hook('context')` in V2 | Implemented |
| Choose a `.workspace` file in Desktop | GUI `Command` + `ctx.desktop.pick({extensions:['workspace']})` | Implemented as extra command in an existing local session |
| Change the built-in initial project picker to accept manifests | `Layout.project` opens a directory picker; no file-filter/replacement contribution found in inspected API | Not implemented; core change or upstream extension needed |
| Persist logical multi-root identity | Plugin storage can key selections by session | Implemented at plugin level; native session Location still has one directory/project |
| Unified native explorer/search/LSP/watchers | GUI Files/tree APIs follow the routed screen workspace; no multiple-root setter found | Not implemented; AI uses plugin file tools |
| Repo-specific status/diff/commit/push | Server plugins may spawn Git with an explicit cwd | Implemented with fixed argument lists, no shell interpolation |
| Native Git UI aggregates extra repos | Native VCS/Location remains separate from plugin root list | Not implemented; Desktop Status command and AI tools provide inspection |
| Native undo of custom writes | Snapshot source uses `location.project.directory`; restore plans are worktree-confined | Not implemented; custom filesystem writes do not join native tool snapshot bookkeeping |
| GUI panels | V2 does expose experimental `Panel`, `Command`, `SettingsPage` registries | Possible API capability; this MVP ships commands, not a panel |
| Worktree adapter as multi-root alias | V1 workspace adapter targets one local directory or remote URL; V2 worktree domain manages individual worktrees | Does not establish multiple independent repos as one native project |
| V1 plugin compatibility | V1 `@opencode-ai/plugin` uses returned hooks; V2 uses `Plugin.define` | V1 not supported |

"No setter found" is a conclusion from the inspected API, not a universal claim that OpenCode
could never support the feature. Revisit against newer SDKs. Do not describe this MVP as native
VS Code multi-root parity.

## References

- [V2 plugin overview and entry points](https://opencode.ai/v2/docs/build/plugins)
- [V2 GUI contracts, commands, native picker and build](https://opencode.ai/v2/docs/build/plugins/gui)
- [V2 server plugin tools and session hooks](https://opencode.ai/v2/docs/build/plugins/server)
- [V2 plugin loading and Desktop global config](https://opencode.ai/v2/docs/plugins)
- [V2 permissions, action names and default policy](https://opencode.ai/v2/docs/permissions)
- [V1 documentation, for comparison only](https://opencode.ai/docs/plugins/)
- [Pinned server plugin context](https://github.com/anomalyco/opencode/blob/893e8dc43f05e872d4cac603486ce8a7181170fa/packages/plugin/src/promise/plugin.ts)
- [Pinned GUI host APIs: Desktop.pick, Layout.project, Sessions.current, Files](https://github.com/anomalyco/opencode/blob/893e8dc43f05e872d4cac603486ce8a7181170fa/packages/plugin/src/gui/host-apis.ts)
- [Pinned GUI registries](https://github.com/anomalyco/opencode/blob/893e8dc43f05e872d4cac603486ce8a7181170fa/packages/plugin/src/gui/registries.ts)
- [Pinned Location schema](https://github.com/anomalyco/opencode/blob/893e8dc43f05e872d4cac603486ce8a7181170fa/packages/schema/src/location.ts)
- [Pinned snapshot implementation](https://github.com/anomalyco/opencode/blob/893e8dc43f05e872d4cac603486ce8a7181170fa/packages/core/src/snapshot.ts)

## Deliberate boundaries

Manifest selection is session-scoped; it does not relocate the session, register a virtual Git
root, merge histories, change the built-in shell cwd, auto-load other repos' config/plugins or
AGENTS.md, or inherit into newly created/forked/subagent sessions. A manifest option is only a
shared fallback. Extra roots remain accessible through normal built-in tools according to
OpenCode's own path and permission rules; the plugin does not redefine those tools.

The GUI is experimental and can change across OpenCode releases. Remote manifests could refer
to a different machine, so this release deliberately rejects picking files for non-sidecar servers.
An API client can use the RPC contract against a server with server-side paths; this is not
advertised as a supported remote Desktop workflow.
