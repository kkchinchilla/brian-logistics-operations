# Deployment and maintenance

## Current environment

- Current release: Increment 1.4.26; see `INCREMENT_1_4_26.md`. This adds the logo to mobile dashboard headers with no new database migration. The route-name migration from 1.4.24 remains installed. The 1.4.21 driver read-only rules remain in place. Brian-only account administration continues to use the existing separately deployed Supabase Edge Function; see `INCREMENT_1_4_19.md`.
- Existing Supabase project: `dispatch-system-dev`, ref `nyizxtaofoynfgazhzsg`.
- Selected host: GitHub Pages, published by `.github/workflows/verify.yml`.
- Access: public login page, followed by Supabase phone/password authentication and existing database permissions. Accounts need a confirmed phone number before using this login form.
- Public source repository: `kkchinchilla/brian-logistics-operations`, approved by the owner. The separate `kkchinchilla/dispatch-system` repository is unchanged.
- GitHub Pages login URL: https://kkchinchilla.github.io/brian-logistics-operations/ (live after the first successful `deploy` job).

## One-time GitHub Pages setup

1. Open https://github.com/kkchinchilla/brian-logistics-operations/settings/pages as a repository administrator.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**. The deployment workflow is already included; no additional starter workflow is needed.
3. Open **Actions → Verify and deploy accepted application**. If a deployment failed before Pages was enabled, rerun the failed jobs. Otherwise run the workflow on `main`.
4. Wait for the `verify` and `deploy` jobs to succeed. The deployment environment reports the live URL.

Enabling Pages is a repository administration operation. The workflow uses only the standard `GITHUB_TOKEN` with `pages: write` and `id-token: write` for deployment; it cannot enable Pages on a repository that has not been configured yet. No personal access token is required for normal deployments.

## Release procedure

1. Start from the source checkout, install the locked dependencies with `npm ci`.
2. Run `npm run build`, `npm run check`, `npm test`, and `npm run test:schema`. Use `npm run test:demo` when touching demonstrations/fixtures.
3. Review the application changes and generated `dist/`. Never put service-role credentials or real exported company records in the source or static output.
4. Commit and push the source to `main`. GitHub Actions installs the locked dependencies, builds `dist/`, and runs application, schema and demonstration checks in an isolated runner.
5. After verification succeeds, the workflow uploads only `dist/` and deploys that same artifact to GitHub Pages. Check the `deploy` job and its environment URL. Deployments are serialized and pull requests cannot publish.
6. Check the login form, loaded script assets and signed-out dashboard redirect. A complete signed-in user acceptance test requires a legitimate application account; do not create test users or write attendance simply to test a deployment.

The verification job has read-only repository permissions. The deployment job has only Pages and identity-token write permissions. Neither job runs SQL against the live Supabase project. Browser assets and navigation use relative paths so that the app works under `/brian-logistics-operations/`.

## Earlier Sites preview

The owner-private preview at https://brian-logistics-operations.sunlitlake65.chatgpt.site uses the persisted project in `.openai/hosting.json`. It has a separate release process and is not updated by this workflow. GitHub Pages is the requested destination for ongoing deployment.

## Rollback

Revert the relevant source change on `main` and allow the workflow to deploy the compatible build. The 1.4.14 client rejects the 1.4.15 calculation response and is not a safe frontend-only rollback. Use a forward correction or a compatible 1.4.15 source commit. Do not rerun historical SQL to roll back a frontend deployment.

After 1.4.21, preserve the driver read-only database rules when correcting the interface. Older clients can no longer submit driver edits or requests; the current driver page redirects legacy bookmarks to the responsive attendance view. Do not restore approval permissions as a cosmetic rollback.

## Verification for this packaging

The 113 accepted assertions passed after source organization. All application JavaScript passed syntax checks, every relative HTML asset/link resolves in `dist`, and internal development directories are excluded from deployment. The portable schema restored into an isolated PGlite database with 41 tables, no prebound finance owner, and anonymous payroll access denied. This is not proof of a full account/password sign-in or hosted business workflow test.

## Account administration backend

Deploy `supabase/functions/account-admin/index.ts` and `handler.mjs` together to the existing project as `account-admin`, with JWT verification enabled. Apply the 1.4.19 migration once before exposing the dashboard. The function reads Supabase-provided runtime keys; secrets never enter the static build or GitHub Actions. GitHub Pages deployment does not deploy Edge Functions or apply migrations.

For another project, configure the finance-owner binding, change the allowed browser origin in `index.ts`, and deploy the function separately. Existing account IDs must be preserved. Deletion uses the supported Auth Admin soft-delete API, deactivating the profile first; never hard-delete a business-linked profile. A failed deletion remains disabled and the account dashboard offers a retry.
