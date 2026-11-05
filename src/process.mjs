import { execFile } from "node:child_process";
import { promisify } from "node:util";
const execute = promisify(execFile);
/** Never invokes a shell. Git hooks/transports still execute according to Git configuration. */
export async function runGit(cwd, args, signal) {
  const env = {
    ...process.env,
    GIT_TERMINAL_PROMPT: "0",
    GIT_PAGER: "cat",
    GIT_LITERAL_PATHSPECS: "1",
  };
  // Inherited index/directory overrides must not redirect operations into another repository.
  for (const key of Object.keys(env))
    if (
      /^GIT_(DIR|WORK_TREE|INDEX_FILE|COMMON_DIR|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CEILING_DIRECTORIES|CONFIG_COUNT|CONFIG_KEY_.*|CONFIG_VALUE_.*)$/.test(
        key,
      )
    )
      delete env[key];
  const { stdout } = await execute("git", ["--no-pager", ...args], {
    cwd,
    env,
    signal,
    timeout: 30000,
    maxBuffer: 2 * 1024 * 1024,
    encoding: "utf8",
  });
  return stdout;
}
