# Release checklist

Repository: [yunusaydogan/OpenCode-Multi-Root-Workspace](https://github.com/yunusaydogan/OpenCode-Multi-Root-Workspace), public, MIT.
GitHub source publication and npm package publication are separate actions.

1. Review the README, license, compatibility notes, and validation evidence against the code.
2. Run `npm ci && npm run check`. With the target OpenCode binary installed, run `npm run test:live` with `OPENCODE_BIN` set.
3. Run `npm pack` and inspect its contents. Exclude credentials, temporary repositories, private paths, and node_modules.
4. Push the reviewed commits to the existing repository with the maintainer's authorization. Confirm GitHub CI passes.
5. Before tagging a release, smoke-test its installed package on Desktop and update the version consistently in package.json and package-lock.json.
6. Optionally attach the built `.tgz` to a GitHub release. Plain source downloads require installation/building.
7. npm publication additionally requires package-name availability, ownership, maintainer authorization, npm credentials/2FA, and a clean package installation check.

No automatic npm publication workflow is included. GitHub publication does not imply an npm release.
