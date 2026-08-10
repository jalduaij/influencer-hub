# PICK Social Club Go-Live Checklist

This checklist assumes the current live stack and deployment model, not a future database rewrite.

## 0. Working Setup Before A Launch Fix

- Read [project-memory.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/project-memory.md) first if the project has been idle for a while.
- Keep new implementation specs in `for-codex/<spec-number>-<short-slug>.md`.
- If this workspace snapshot does not have a `.git` directory, use the sibling shell-git worktree at `/Users/jalduaij/Documents/Codex/influencer-hub-shell`.
- Refresh that sibling worktree with [scripts/refresh-shell-worktree.sh](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/refresh-shell-worktree.sh) before starting a release-day fix.
- For frontend or design-sensitive fixes, use staging as the approval surface before any production manual deploy.

## 1. Ownership And Access

- Confirm who owns staging verification.
- Confirm who is allowed to manual-deploy production.
- Confirm who owns:
  - member approval
  - campaign creation
  - code CSV upload
  - branch updates
  - master data updates
  - Terms & Conditions updates
  - first-line support when launch issues are reported
- Confirm at least one backup admin account path exists via [scripts/bootstrap-admin.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/bootstrap-admin.js).

## 2. Content And Data Readiness

- Confirm production branches are correct:
  - name EN / AR
  - location cascade
  - map links
  - branch images if used
- Confirm categories, platforms, and tags are clean and intentional.
- Confirm Terms & Conditions text has final lawyer-reviewed EN and AR content.
- Confirm campaign banners and journal images load correctly.
- Confirm live campaigns have:
  - correct title and copy
  - correct branch scope
  - correct targeting
  - correct deadlines
  - uploaded codes

## 3. Member Experience Readiness

- Confirm signup works end to end.
- Confirm residential location cascade works in both Arabic and English.
- Confirm category checklist works and requires at least one category.
- Confirm Date of birth appears and remains optional.
- Confirm shipping address can be saved from profile.
- Confirm Terms & Conditions consent is required at signup.
- Confirm the public `/terms` page loads correctly in EN and AR.

## 4. Campaign Operations Readiness

- Confirm campaign creation redirects directly into campaign edit.
- Confirm code CSV upload works.
- Confirm banner upload works.
- Confirm the campaign targeting cascade is filtered by country correctly.
- Confirm the match-count tile updates live and looks correct.
- Confirm campaign review pages show proof thumbnails and readable feedback.

## 5. Data Durability Checks

- Confirm runtime writes are happening under `DATA_DIR`.
- Confirm upload persistence survives a restart.
- Confirm there are no broken banner / avatar / branch / journal image references.
- If needed, use [scripts/migrate-103-clear-dead-image-refs.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-103-clear-dead-image-refs.js).

## 6. Arabic And Text Integrity Checks

- Confirm Arabic labels render correctly across signup, campaigns, members, and reports.
- Confirm Arabic feedback submissions render correctly without mojibake.
- If legacy bad records exist, use [scripts/migrate-106-fix-feedback-encoding.js](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/scripts/migrate-106-fix-feedback-encoding.js).

## 7. Staging Sign-Off Before Production

- Deploy latest code to staging through `main`.
- Run any required one-time migration scripts on staging.
- Restart staging if a script requires it.
- Verify the launch-critical paths:
  - admin login
  - campaign manager login
  - member login
  - member signup
  - campaign create/edit/banner/codes flow
  - branch create/edit
  - member join / visit / submit proof
  - proof review surfaces
  - reports
- Record who signed off and when.

## 8. Production Release Day

- Confirm the exact commit being promoted.
- Manual deploy production on Render.
- Run any required production script for that release.
- Restart production if the release requires it.
- Smoke check immediately after deploy:
  - homepage loads
  - admin login works
  - at least one campaign opens
  - uploads render
  - `/terms` loads
  - proof review still works

## 9. First Week After Launch

- Watch for:
  - missing uploads
  - broken Arabic text
  - campaign code issues
  - proof submission failures
  - master data confusion
  - branch location mistakes
- Keep staging available for rapid repro and verification.
- Document every production issue with:
  - user role
  - exact page
  - campaign or branch involved
  - reproduction steps
  - screenshots if possible

## 10. Not A Blocking Launch Item

These are still worthwhile later, but they are not required to launch the current stack:

- database migration to PostgreSQL
- object storage migration
- auth hardening beyond the current app
- richer analytics / reconciliation work
