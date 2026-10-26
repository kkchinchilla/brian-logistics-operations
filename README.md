# 貨易通

Current release: **Increment 1.4.53 — deleted-account attendance roster fix** (2026-10-26). See the [preparation handoff](docs/android/PRE_PLAY_HANDOFF.md) and [acceptance tracker](docs/android/RELEASE_READINESS.md). Android remains in testing; this is not public-launch approval.

Traditional Chinese logistics dispatch, daily attendance, route and vehicle management, and monthly payroll reconciliation. Vanilla HTML/CSS/JavaScript with Supabase Auth, PostgreSQL, RPCs and row-level security.

**應計薪資 = 配送計酬 + 值班津貼 + 跟車費用 + 學習費用 − 租車費用 + 加給／獎懲**

底薪 is excluded. 值班、跟車、學習 each use a shared per-assignment rate set by Brian. Additional rules from 台11508.xls are outside the accepted scope. Company-layout Excel export and frozen paid-month amounts remain future work.

Reopening an attendance date keeps its last confirmed records in monthly reporting. Draft edits remain on the attendance board until the next 「確認結案」 replaces that date’s report contents, including deletions. The monthly report labels dates awaiting reconfirmation. Dates never confirmed remain excluded.

## Run and build

Requires Node.js 22 and Python 3 for the optional offline demonstration.

```sh
npm ci
npm run build
npm run check
npm test
npm run test:schema
npm run test:demo
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/` for the login page. Sign in with an existing active Supabase account. This repository contains no passwords, user accounts, or company records.

`config/public.json` contains the current project's intentionally public browser key and URL. To target a separate test backend, copy it to ignored `config/local.json` or supply `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` at build time. The build rejects secret/service-role keys and writes browser configuration only to `dist/js/config.js`.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html` | System login |
| `ui-attendance.html`, `ui-routes.html`, `ui-vehicles.html`, `ui-monthly.html`, `ui-accounts.html` | Attendance, routes, fleet, monthly reports and account management |
| Other root HTML files | Retained legacy tools; the old driver page redirects to current attendance |
| `js/`, `css/` | Application code and styling |
| `config/` | Public connection settings |
| `scripts/` | Build, asset validation, schema generation and restore verification |
| `supabase/functions/account-admin/` | Privileged account endpoint deployed separately to Supabase Edge Functions |
| `supabase/migrations/` | Original incremental migration source; already installed in the connected project |
| `supabase/schema/` | Portable schema-only snapshot of the complete accepted structure |
| `sql/` | Historical changes and read-only verification queries |
| `tests/` | Isolated synthetic tests, including payroll, close/reopen, phone login, accounts, and driver read-only access |
| `examples/offline-1.4.15/` | Fictional, network-disabled demonstration generated from the app |
| `docs/` | Current architecture, deployment and database instructions; historical handoffs |
| `.github/workflows/verify.yml` | Build, regression checks, and GitHub Pages deployment from `main` |
| `.openai/hosting.json` | Earlier private Sites preview configuration |
| `dist/` | Generated deployable application, ignored by Git |

## Deployment

Build with `npm run build`; publish **only `dist/`**. This prevents SQL, documentation, tests and schema definitions from becoming web assets. The login page is `/` (`index.html`). Retain ordinary `.html` routes; do not use an SPA rewrite for every missing path.

The selected deployment destination is **GitHub Pages**, with login address https://kkchinchilla.github.io/brian-logistics-operations/. The repository administrator must first set **Settings → Pages → Source → GitHub Actions**. A successful `deploy` job publishes the tested build; the expected address is not live until that job succeeds. Every subsequent push to `main` runs the checks and deploys only after they pass. Pull requests run checks without deploying.

Source repository: [kkchinchilla/brian-logistics-operations](https://github.com/kkchinchilla/brian-logistics-operations). Public source and GitHub Pages publication were approved by the owner. The public login page uses the existing Supabase account authentication and database permissions. GitHub Pages does not require visitors to sign in to GitHub or ChatGPT. The separate `dispatch-system` repository is unchanged.

The earlier owner-private Sites preview remains at https://brian-logistics-operations.sunlitlake65.chatgpt.site. It is not updated by the GitHub Pages workflow.

Read [architecture](docs/ARCHITECTURE.md), [database setup](docs/DATABASE.md), and [deployment](docs/DEPLOYMENT.md). Current decisions override all historical documents.
