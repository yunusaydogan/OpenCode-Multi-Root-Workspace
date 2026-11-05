# Publication checklist

Prepared target: `yunusaydogan/opencode-multi-root-workspace`, public, MIT.
This is a proposed target until the owner approves publication. No claim of an existing GitHub
repository or npm release is made. A GitHub connection confirms account identity but does not
by itself approve publishing the files publicly.

1. Review README, license, tests and `docs/validation.md`; run `npm ci && npm run check`.
2. Inspect `npm pack --dry-run` to exclude temporary repos, absolute machine paths, credentials
   and node_modules. Source documentation uses example paths only.
3. Obtain explicit owner approval for the public repository and initial push.
4. Create the repository on GitHub (or with authenticated `gh repo create`), then push local `main`.
   Example, after approval and with GitHub CLI configured:

   ```sh
   gh repo create yunusaydogan/opencode-multi-root-workspace --public --source=. --remote=origin --push
   ```

5. Confirm GitHub CI passes. Set repository description, topics, and the correct repository URL
   in package.json. Tag `v0.1.0` only after smoke testing the packaged artifact on Desktop.
6. Optionally attach the built `.tgz` to a GitHub release. Plain source downloads need a build.
7. npm publication is a **separate** action requiring name availability, ownership, approval,
   npm credentials/2FA and a clean packed-artifact smoke test. Never assume a GitHub push is npm publication.

No automatic npm publish workflow is included. Publishing is not needed for local installation.
