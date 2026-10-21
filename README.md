# Brian Logistics Operations

Accepted application: **Increment 1.4.15**, confirmed 2026-10-21.

Traditional Chinese logistics dispatch, daily attendance, route and vehicle management, and monthly payroll reconciliation. Vanilla HTML/CSS/JavaScript with Supabase Auth, PostgreSQL, RPCs and row-level security.

**應計薪資 = 配送計酬 − 租車費用 + 加給／獎懲**

底薪 is excluded. 值班、跟車、學習 are attendance records/counts only. Additional rules from 台11508.xls are outside the accepted scope. Company-layout Excel export and frozen paid-month amounts remain future work.

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
| `ui-attendance.html`, `ui-routes.html`, `ui-vehicles.html`, `ui-monthly.html` | Four accepted dashboards |
| Other root HTML files | Retained legacy tools linked from the dashboards |
| `js/`, `css/` | Application code and styling |
| `config/` | Public connection settings |
| `scripts/` | Build, asset validation, schema generation and restore verification |
| `supabase/migrations/` | Original incremental migration source; already installed in the connected project |
| `supabase/schema/` | Portable schema-only snapshot of the complete accepted structure |
| `sql/` | Historical changes and read-only verification queries |
| `tests/` | Isolated synthetic tests; `increment_1415/` is the current contract |
| `examples/offline-1.4.15/` | Fictional, network-disabled demonstration generated from the app |
| `docs/` | Current architecture, deployment and database instructions; historical handoffs |
| `.github/workflows/verify.yml` | Build and regression checks plus downloadable application artifact |
| `.openai/hosting.json` | Registered private Sites project and static output directory |
| `dist/` | Generated deployable application, ignored by Git |

## Deployment

Build with `npm run build`; publish **only `dist/`**. This prevents SQL, documentation, tests and schema definitions from becoming web assets. The login page is `/` (`index.html`). Retain ordinary `.html` routes; do not use an SPA rewrite for every missing path.

The deployed host is a private Sites project, `appgprj_6ad8d1520fa081918fc641a01198c53c`. Its login address is https://brian-logistics-operations.sunlitlake65.chatgpt.site. Native deployment status is authoritative for whether it is live. Owner-private hosting adds a ChatGPT access check before the existing Supabase application login. Sharing with Brian or drivers requires a separately agreed hosting audience.

Source repository: [kkchinchilla/brian-logistics-operations](https://github.com/kkchinchilla/brian-logistics-operations). Public source publication was approved by the owner. This is separate from the existing `dispatch-system` repository. GitHub CI validates and packages the app; it does not automatically publish to Sites. Public source visibility does not change the private hosting audience or Supabase account permissions.

Read [architecture](docs/ARCHITECTURE.md), [database setup](docs/DATABASE.md), and [deployment](docs/DEPLOYMENT.md). Current decisions override all historical documents.
