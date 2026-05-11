# PICK Social Club Prototype

This workspace now contains:

- [influencer-management-system-spec.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/influencer-management-system-spec.md)
- [technical-architecture.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/technical-architecture.md)
- [database-schema.sql](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/database-schema.sql)
- [screens-and-user-flows.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/screens-and-user-flows.md)
- a dependency-free Node web app in [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
- the browser client in [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
- file-backed seed data in [data/store.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/data/store.json)

## App Notes

The app is intentionally framework-free so it can run in the current environment without installing packages.

It includes:

- cookie-based login with role-driven dashboard routing
- seeded campaigns, members, and branches
- member approvals
- campaign creation
- campaign editing for admin and campaign manager
- campaign code CSV upload by campaign manager
- eligible campaign joining
- private code reservation at campaign join
- visit confirmation using the already-assigned campaign code
- post link and feedback submission
- report summaries for campaign/code/visit/submission performance
- Arabic and English UI toggle

## Run Locally

Run:

```bash
/Applications/Codex.app/Contents/Resources/node server.js
```

Or use the helper script:

```bash
./start.sh
```

Then open [http://localhost:5050](http://localhost:5050).

If your terminal says `command not found: node`, use `./start.sh` or the full runtime path above. This project can use the Node runtime bundled inside Codex.

`./start.sh` now defaults to watch mode on port `5050`, and you can opt out with:

```bash
./start.sh --no-watch
```

## Stage Deployment

Staging prep files are now included:

- [package.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/package.json)
- [.env.example](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/.env.example)
- [render.yaml](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/render.yaml)
- [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
- [go-live-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/go-live-checklist.md)

The current architecture is ready for **stage testing**. It is still file-based, so it is best for internal/staging use before moving to database-backed production.

## Demo Credentials

Team accounts:

- Sara — Admin — `sara@pick.internal` / `pick123`
- Nasser — Campaign Manager — `nasser@pick.internal` / `pick123`
- Jassem — Campaign Manager — `jalduaij@kdigtc.com` / `123`

Member accounts:

- Laila — everything-state Member — `laila@example.com` / `member123`
- Maha — 23k followers, VIP — `maha@example.com` / `member123`
- Dana — 47k followers, beauty/VIP — `dana@example.com` / `member123`
- Abdullah — 18k followers, fitness, male — `abdullah@example.com` / `member123`
- Bader — incomplete profile (0 followers) — `bader@example.com` / `member123`
- Youssef — tagged family — `youssef@example.com` / `member123`
- Nada — pending (approve me) — `nada@example.com` / `member123`
- Maryam — suspended (try reactivating) — `maryam@example.com` / `member123`

## UAT Seed

Use the rich UAT seed when the QA team needs a clean, repeatable dataset with varied campaigns, members, submissions, and audit history.

Generate the bundled dataset locally:

```bash
node scripts/seed-uat-data.js
```

Write the same dataset to another file for inspection:

```bash
node scripts/seed-uat-data.js --out /tmp/test-uat-store.json
```

On staging with a persistent disk, an admin can reseed runtime data without a redeploy:

```bash
curl -X POST "$APP_BASE_URL/api/admin/reset-uat-data" \
  -H "Content-Type: application/json" \
  -H "Origin: $APP_BASE_URL" \
  -b "<admin session cookie>" \
  -d '{"confirm":"yes-overwrite-staging"}'
```

Seeded member password:

- All seeded members use `member123`

Deterministic branch PINs for cashier and branch-flow UAT:

- `PICK The Avenues`: `100001`
- `PICK 360 Mall`: `100002`
- `PICK Al Kout`: `100003`

## Code Logic

Campaign capacity is driven by uploaded code count. If a campaign has 200 uploaded CSV codes, it can support 200 member participations.

When a member confirms interest:

- one available code is reserved immediately
- that code becomes private to that member
- the code cannot be assigned to anyone else
- after the branch visit, the member confirms the visit and the code becomes used
