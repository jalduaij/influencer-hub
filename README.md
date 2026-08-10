# PICK Social Club Current System Guide

This repository contains the current PICK Social Club web app and the operational docs needed to support staging, production deploys, QA, and launch readiness.

## What This System Is Today

- a dependency-light Node.js web app in [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
- a browser client in [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
- styling in [styles.css](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/styles.css)
- a file-backed runtime store in [data/store.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/data/store.json)
- persistent uploads under `DATA_DIR/uploads`
- read-only bundled reference data in [seeds/address-reference.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/seeds/address-reference.json) and [seeds/terms-default.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/seeds/terms-default.json)

This is the current live system shape. It is file-backed, but it is no longer just an early mockup or throwaway prototype.

## Source Of Truth Docs

Use these first:

- [project-memory.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/project-memory.md)
  Working agreement for this project: source of truth order, standard workflow, staging approval rule, and resume-after-a-gap instructions.
- [launch-ops-summary.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/launch-ops-summary.md)
  Current operational overview, bug triage map, deploy flow, and script index.
- [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
  Current staging and production deployment workflow on Render.
- [go-live-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/go-live-checklist.md)
  Launch-readiness checklist for the live system.
- [uat-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/uat-checklist.md)
  Current QA/UAT checklist that matches the app as it exists now.

Reference-only docs:

- [influencer-management-system-spec.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/influencer-management-system-spec.md)
- [screens-and-user-flows.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/screens-and-user-flows.md)
- [technical-architecture.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/technical-architecture.md)

Those older docs are still useful for product context, but they are not the best place to check current live behavior.

## Read This First After A Gap

If the project has been quiet for days or weeks, open these in order:

1. [project-memory.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/project-memory.md)
2. [launch-ops-summary.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/launch-ops-summary.md)
3. [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
4. the active spec under `for-codex/`

That is the official cold-start path for this project.

## Workspace And Git Notes

- Staging is the visual source of truth for this project.
- Localhost can still be useful for isolated reproduction, but it should not be treated as the approval surface for design-heavy specs unless explicitly agreed.
- GitHub connector access and shell Git access are separate things.
- If shell Git says `fatal: not a git repository`, this folder is a workspace snapshot without a real `.git` directory.
- If shell Git says `Could not resolve host: github.com`, that is a shell DNS / network problem, not a GitHub token problem.
- If the GitHub connector is healthy, prefer it over shell network troubleshooting for repo reads and writes.
- Current shell-git worktree path: `/Users/jalduaij/Documents/Codex/influencer-hub-shell`
- Refresh or rebuild that worktree with `./scripts/refresh-shell-worktree.sh`

## Spec Intake Convention

- Save every new implementation spec under [for-codex/README.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/for-codex/README.md)'s folder as `for-codex/<spec-number>-<short-slug>.md`.
- If a spec arrives as pasted text or an attachment, copy it into `for-codex/` before implementation so the next session can reopen it quickly.
- When a spec affects deploy flow, staging scripts, production rollout, or standard working method, also update the relevant operational `.md` files in this repo in the same pass.

## Current Product Scope

The app currently supports:

- bilingual Arabic / English UI
- role-based access for admin, campaign manager, and member
- member signup with required residential cascade, category checklist, optional DOB, optional shipping address, and Terms & Conditions consent
- admin approval and member management
- admin-on-behalf member profile editing
- campaign creation, editing, duplication, targeting, banner upload, and code CSV upload
- branch management with address-reference location cascade
- master data for categories, platforms, tags, and Terms & Conditions
- member campaign join, visit confirmation, proof submission, and proof image upload
- reviewer visibility of proof thumbnails in campaign and member review surfaces
- reporting, journal content, and audit logging

## Environment Model

Current deployment model:

- staging auto-deploys from `main`
- production is manual deploy only
- production traffic should use the custom domain `https://club.pick.com.kw`

See [launch-ops-summary.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/launch-ops-summary.md) and [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md) for the exact flow.

## Critical Storage Rules

Anything written at runtime must live under `DATA_DIR`.

Current safe pattern:

- store file: `DATA_DIR/store.json`
- backups: `DATA_DIR/backups`
- uploads: `DATA_DIR/uploads`

Read-only bundled assets and reference files should stay outside `data/`, for example:

- `seeds/address-reference.json`
- `seeds/terms-default.json`

## Run Locally

Use:

```bash
./start.sh
```

Or:

```bash
node server.js
```

Default local URL:

- [http://localhost:5050](http://localhost:5050)

Local run reminder:

- use local only for development and reproduction
- use staging for final visual verification and rollout sign-off

## Useful Scripts

- `node scripts/smoke-test.js`
  Broad local smoke test.
- `node scripts/seed-uat-data.js`
  Reseed rich UAT data locally.
- `node scripts/bootstrap-admin.js`
  Bootstrap or recover an admin account when needed.
- `node scripts/migrate-91-residential-cascade.js`
  Historical destructive wipe used for the residential schema reset.
- `node scripts/migrate-94-dedupe-ids.js`
  Cleanup for duplicate reference IDs.
- `node scripts/migrate-96-fix-terms-email.js`
  Repairs old T&C contact email values.
- `node scripts/migrate-99-branches-address-ref.js`
  Migrates branches from legacy city references to address-reference locations.
- `node scripts/migrate-103-clear-dead-image-refs.js`
  Clears image references whose upload files no longer exist.
- `node scripts/migrate-106-fix-feedback-encoding.js`
  Repairs mojibake participant feedback stored before the multipart UTF-8 fix.
- `./scripts/refresh-shell-worktree.sh`
  Rebuilds the sibling shell-git worktree at `/Users/jalduaij/Documents/Codex/influencer-hub-shell`.

## Demo / UAT Accounts

Team accounts:

- Sara — Admin — `sara@pick.internal` / `pick123`
- Nasser — Campaign Manager — `nasser@pick.internal` / `pick123`
- Jassem — Campaign Manager — `jalduaij@kdigtc.com` / `pick123`

Member accounts commonly used in local / staging seed data:

- Laila — `laila@example.com` / `member123`
- Maha — `maha@example.com` / `member123`
- Abdullah — `abdullah@example.com` / `member123`

The richer seeded data may include more test members depending on the seed script used.

## If A Bug Comes In

Start here:

1. Read [launch-ops-summary.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/launch-ops-summary.md).
2. Identify the feature area and likely files.
3. Confirm whether the issue is:
   - code / UI
   - seed data / runtime data
   - deployment / environment
   - one-off migration fallout
4. Reproduce locally or on staging before touching production.

That document is the fastest operational ramp-up path for future fixes.
