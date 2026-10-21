# Deployment and maintenance

## Current environment

- Accepted application: Increment 1.4.15.
- Existing Supabase project: `dispatch-system-dev`, ref `nyizxtaofoynfgazhzsg`.
- Host identity: `.openai/hosting.json`; retain this project ID on subsequent deployments.
- Access: private to the Site owner, followed by Supabase email/password authentication.
- Public source repository: `kkchinchilla/brian-logistics-operations`, approved by the owner. The separate `kkchinchilla/dispatch-system` repository is unchanged.
- Login URL: https://brian-logistics-operations.sunlitlake65.chatgpt.site (private Site audience).

## Release procedure

1. Start from the source checkout, install the locked dependencies with `npm ci`.
2. Run `npm run build`, `npm run check`, `npm test`, and `npm run test:schema`. Use `npm run test:demo` when touching demonstrations/fixtures.
3. Review the application changes and generated `dist/`. Never put service-role credentials or real exported company records in the source or static output.
4. Commit the source. For Sites, obtain a short-lived source credential for the persisted project, then use the Sites source helper to commit/push, build and package that exact source.
5. Publish the matching archive and commit through the native Sites operation for the current audience. Poll nonterminal deployments and retain the returned live URL.
6. Check the login form, loaded script assets and signed-out dashboard redirect. A complete signed-in user acceptance test requires a legitimate application account; do not create test users or write attendance simply to test a deployment.

GitHub's included workflow runs isolated tests and creates a `dist` artifact. It has read-only repository permissions and does not run SQL against Supabase. Sites hosting is an explicit release step; no automatic GitHub-to-Sites deployment has been configured.

## Rollback

Use a previous saved Site version only if it matches the current database contract. The 1.4.14 client rejects the 1.4.15 calculation response and is not a safe frontend-only rollback. Use a forward correction or a compatible 1.4.15 source commit. Do not rerun historical SQL to roll back a frontend deployment.

## Verification for this packaging

The 113 accepted assertions passed after source organization. All application JavaScript passed syntax checks, every relative HTML asset/link resolves in `dist`, and internal development directories are excluded from deployment. The portable schema restored into an isolated PGlite database with 41 tables, no prebound finance owner, and anonymous payroll access denied. This is not proof of a full account/password sign-in or hosted business workflow test.
