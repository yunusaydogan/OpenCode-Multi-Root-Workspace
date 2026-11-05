#!/usr/bin/env node
import {
  loadWorkspace,
  workspaceContext,
  fileOperation,
  gitOperation,
} from "./core.mjs";
const [command, manifest, root, path] = process.argv.slice(2);
try {
  if (
    !manifest ||
    !["validate", "info", "status", "diff", "list", "read"].includes(command)
  )
    throw Error(
      "Usage: oc-workspace <validate|info|status|diff|list|read> file.workspace [root] [path]\nRead-only helper; mutations are available through permission-checked OpenCode tools.",
    );
  const ws = await loadWorkspace(manifest);
  if (command === "validate" || command === "info")
    console.log(workspaceContext(ws));
  else if (command === "status" || command === "diff")
    for (const r of ws.roots.filter((r) => !root || r.name === root))
      console.log(
        `${r.name}\n${await gitOperation(ws, { op: command, root: r.name })}`,
      );
  else console.log(await fileOperation(ws, { op: command, root, path }));
  if (root && !ws.roots.some((r) => r.name === root))
    throw Error(`Unknown root: ${root}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
