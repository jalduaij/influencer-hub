# PICK Social Club Deployment Guide

This document describes the current deployment workflow as of August 9, 2026.

## Working Assumptions

- GitHub repository `jalduaij/influencer-hub` on `main` is the code source of truth.
- Render staging is the approval surface for UI, layout, and behavior verification.
- The local Codex workspace may be stale and must not be treated as inherently current.
- If shell Git networking is blocked but the GitHub connector works, use the connector path rather than stopping work.

## Current Render Environments

| Environment | Service name | URL | Purpose | Deploy mode |
| --- | --- | --- | --- | --- |
| Staging | `pick-influence-hub-stage` | `https://pick-influence-hub-stage.onrender.com` | QA, UAT, bug verification | Auto-deploy from `main` |
| Production | `pick-social-club` | `https://club.pick.com.kw` | Live member and team use | Manual deploy only |

Production notes:

- Use `https://club.pick.com.kw` as the canonical production URL.
- Production should not be treated as auto-deploying from `main`.
- Validate on staging first, then manually promote to production.

## Design And Spec Rules

- For visual or frontend-heavy work, staging is the approval surface.
- Localhost can be used for development and debugging, but it is not automatically the trusted design baseline.
- New implementation specs should be copied into [for-codex/README.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/for-codex/README.md)'s folder before work starts.
- If the local workspace and staging disagree visually, staging wins.

## Storage Rules

The app is file-backed and depends on durable disk paths.

Safe runtime storage:

- `DATA_DIR/store.json`
- `DATA_DIR/backups/`
- `DATA_DIR/uploads/`

Read-only bundled files that should stay outside `data/`:

- `seeds/address-reference.json`
- `seeds/terms-default.json`

If a future change introduces new writable files, they must also live under `DATA_DIR`.

## Environment Variables

The minimum important variables are:

- `NODE_ENV=production`
- `APP_BASE_URL=<environment URL>`

Current code also supports:

- `DATA_DIR`
- `STORE_PATH`
- `UPLOAD_DIR`

The safe default upload path is now under `DATA_DIR/uploads`, even if older docs or examples still mention repo-root `uploads/`.

## Standard Release Flow

### For normal code-only changes

1. Save the active spec into `for-codex/`.
2. Implement against the real project state.
3. Update operational docs in the same pass when workflow or rollout rules changed.
4. Push to `main`.
5. Wait for staging to auto-deploy.
6. Verify behavior on staging.
7. Use Render `Manual Deploy` for production.
8. Run a quick production smoke check.

For UI-heavy specs:

- do not sign off from localhost alone
- compare the result on staging before production promotion

### For changes that need a one-time script

1. Push to `main`.
2. Verify staging code deploy completed.
3. Run any required script in staging shell.
4. Restart staging if the script requires it.
5. Verify staging behavior.
6. Manually deploy production.
7. Run the same required production script if applicable.
8. Restart production if required.
9. Smoke check production.

## Current Useful Shell Scripts

- `node scripts/bootstrap-admin.js`
- `node scripts/seed-uat-data.js`
- `node scripts/migrate-94-dedupe-ids.js`
- `node scripts/migrate-99-branches-address-ref.js`
- `node scripts/migrate-103-clear-dead-image-refs.js`
- `node scripts/migrate-106-fix-feedback-encoding.js`

Historical scripts such as the spec 91 wipe should only be run intentionally and with full awareness of their data impact.

## Recommended Staging Smoke Checks

After staging deploy, check at least:

- login for admin, campaign manager, and member
- member signup
- member residential and shipping flows
- campaign create -> edit -> banner -> codes flow
- branch creation/editing
- proof submission and proof image review
- reports and dashboards
- Terms & Conditions page and editor

## Recommended Production Smoke Checks

After a production manual deploy:

- open [https://club.pick.com.kw](https://club.pick.com.kw)
- confirm admin login works
- confirm a recent campaign opens
- confirm banners and uploads still render
- confirm proof submissions and thumbnails render
- confirm no obvious mojibake or broken Arabic copy

## What This File Is For

Use this document for:

- how deploys currently work
- which environment gets what
- where runtime data safely lives
- what to verify after a deployment

For broader launch coordination, use [go-live-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/go-live-checklist.md).
