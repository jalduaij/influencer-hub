# PICK Social Club Launch & Ops Summary

This is the quickest current-reference document for launch, deployments, support triage, and bug response.

## Read Order After A Long Gap

Open these in order:

1. [project-memory.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/project-memory.md)
2. this file
3. [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
4. the active spec under `for-codex/`

## Current Environments

| Environment | Service | URL | Deploy mode |
| --- | --- | --- | --- |
| Staging | `pick-influence-hub-stage` | `https://pick-influence-hub-stage.onrender.com` | Auto-deploy from `main` |
| Production | `pick-social-club` | `https://club.pick.com.kw` | Manual deploy only |

Notes:

- Production should be accessed through `https://club.pick.com.kw`.
- The Render `onrender.com` production hostname is not the canonical user-facing URL.
- Deploy to staging first, verify there, then manually deploy production.

## Workspace / Git Reality

- GitHub `main` is the code source of truth for this project.
- Render staging is the approval surface for UI and behavior sign-off.
- The local Codex workspace may be stale and must not automatically be trusted over GitHub or staging.
- The GitHub connector can be healthy even when shell Git is not.
- If shell Git reports `fatal: not a git repository`, the current folder is a workspace snapshot without a real clone.
- If shell Git reports `Could not resolve host: github.com`, the blocker is shell DNS / network access, not GitHub token auth.
- Current shell-git worktree path: `/Users/jalduaij/Documents/Codex/influencer-hub-shell`
- Rebuild or refresh it with `./scripts/refresh-shell-worktree.sh`
- If the GitHub connector is available, use it directly for repo reads and writes instead of blocking on shell Git networking.
- For design-heavy work, staging is the source of truth. Localhost is for reproduction, not automatic approval.
- New specs should be stored under [for-codex/README.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/for-codex/README.md)'s folder so the next session can reopen them quickly.

## Current Stack

- backend: [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
- frontend: [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
- styling: [styles.css](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/styles.css)
- runtime data: [data/store.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/data/store.json)
- read-only reference data: [seeds/address-reference.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/seeds/address-reference.json), [seeds/terms-default.json](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/seeds/terms-default.json)

## Non-Negotiable Storage Rules

Anything written at runtime must live under `DATA_DIR`.

Current durable paths:

- `DATA_DIR/store.json`
- `DATA_DIR/backups/`
- `DATA_DIR/uploads/`

Current non-durable locations that should never hold writable production state:

- `seeds/`
- repo-root `uploads/` as a primary runtime destination
- any path outside `DATA_DIR`

## Core Deploy Flow

### Standard code deploy

1. Save the active spec in `for-codex/`.
2. Work against the real project state.
3. Push or write the change to GitHub `main`.
4. Wait for staging auto-deploy.
5. Verify on staging.
6. If good, use Render `Manual Deploy` for production.

### If a spec includes a migration or recovery script

1. Deploy code to staging.
2. Run the script in staging shell if the spec requires it.
3. Restart staging if the script says so.
4. Verify behavior.
5. Manual deploy production.
6. Run the production shell script if required.
7. Restart production if required.

## Fast Bug Triage Map

### Signup / profile bugs

Check:

- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
  `renderSignupForm`, profile forms, signup draft logic, field validation wiring
- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  `validateResidential`, `validateCategoryIds`, signup and profile handlers

Typical topics:

- residential cascade
- categories checklist
- DOB
- shipping address
- Terms & Conditions consent

### Campaign bugs

Check:

- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
  `renderCampaignForm`, campaign preview tile, create/edit submit flows, campaign review pages
- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  campaign create/edit handlers, matching logic, code upload logic

Typical topics:

- targeting by country / governorate / city
- code capacity and CSV upload
- banner upload
- redirect from create to edit
- reviewer tables and proof thumbnails

### Member proof / submission bugs

Check:

- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  `parseMultipart`, `handleSubmission`, `persistUploadedImage`
- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
  proof submission views, review tables, member campaign cards

Typical topics:

- Arabic feedback encoding
- proof image upload
- missing thumbnails
- post-submission status transitions

### Branch bugs

Check:

- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
  branch form, `branchLocationDisplay`
- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  branch create/update validation

Typical topics:

- address-reference cascade
- branch image upload
- branch visibility in campaigns

### Terms & legal content bugs

Check:

- [terms.html](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/terms.html)
- [client.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/client.js)
  master data T&C editor, signup consent checkbox
- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  `/api/terms`, admin T&C update handler, acceptance snapshotting

### Upload and media bugs

Check:

- [server.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/server.js)
  `UPLOAD_DIR`, upload persistence, upload logging
- [scripts/migrate-103-clear-dead-image-refs.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-103-clear-dead-image-refs.js)

Typical topics:

- missing files after restart
- dead banner/avatar/branch/journal references
- wrong storage path

## Key Historical Scripts

These are already in the repo and matter operationally:

- [scripts/bootstrap-admin.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/bootstrap-admin.js)
  Recover or bootstrap an admin if access is lost.
- [scripts/seed-uat-data.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/seed-uat-data.js)
  Build rich UAT data.
- [scripts/migrate-91-residential-cascade.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-91-residential-cascade.js)
  Destructive historical wipe used when moving to residential cascade.
- [scripts/migrate-94-dedupe-ids.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-94-dedupe-ids.js)
  Fixes duplicate numeric IDs in reference tables.
- [scripts/migrate-96-fix-terms-email.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-96-fix-terms-email.js)
  Repairs older seeded T&C email text.
- [scripts/migrate-99-branches-address-ref.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-99-branches-address-ref.js)
  Moves branches off the retired legacy cities table.
- [scripts/migrate-103-clear-dead-image-refs.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-103-clear-dead-image-refs.js)
  Clears dead media references after missing-upload incidents.
- [scripts/migrate-106-fix-feedback-encoding.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-106-fix-feedback-encoding.js)
  Repairs mojibake participant feedback stored before the multipart UTF-8 fix.

## Current High-Risk Areas Before Launch

- docs drift between older prototype docs and the current live system
- anything involving runtime file storage
- production-only data issues that do not show up in local seed data
- address-reference and location cascade UX
- proof submission and review surfaces
- production deployment discipline: staging first, production second

## Best Docs To Open First In A Real Incident

1. [README.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/README.md)
2. this file
3. [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
4. [uat-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/uat-checklist.md)

That is the shortest path back to context when a bug report comes in.
