# Spec Intake Convention

Use this folder for incoming implementation specs before work starts.

## Naming

- `for-codex/107-detective-mascot-integration.md`
- `for-codex/108-some-follow-up-fix.md`

Keep the pattern:

- spec number first
- short hyphenated slug second
- `.md` extension

## Workflow

1. If a spec arrives as pasted text, copy it into this folder immediately.
2. If a spec arrives as an attachment, create a matching `.md` file here and paste the exact content into it.
3. Treat that saved file as the spec source of truth for the implementation pass.
4. If the local workspace may be stale, verify the real project state from GitHub and staging before building UI changes.
5. If the spec changes deployment behavior, rollout steps, staging scripts, or production safety rules, update:
   - [staging-deployment.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/staging-deployment.md)
   - [project-memory.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/project-memory.md)
   - [launch-ops-summary.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/launch-ops-summary.md)
   - [go-live-checklist.md](/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a/go-live-checklist.md)
     when launch steps are affected
6. For UI or design-heavy specs, verify on staging. Localhost is not the approval surface unless explicitly chosen for that task.

## Why This Exists

- avoids losing specs in chat attachments
- gives every future session a stable file path
- keeps rollout notes current when specs affect staging or production
