# PICK Social Club Project Memory

This file is the non-negotiable working memory for this project. Read it first after any long gap.

## Default Truth Order

When there is any confusion, trust sources in this order:

1. GitHub repository `jalduaij/influencer-hub` on branch `main`
2. Render staging at `https://pick-influence-hub-stage.onrender.com`
3. This local Codex workspace snapshot

Important meaning:

- GitHub `main` is the code source of truth.
- Staging is the visual and behavior approval surface.
- The local workspace may drift and must not be assumed to match `main`.

## How We Work By Default

This is the standard workflow unless the user explicitly asks for something else:

1. Save the incoming spec under `for-codex/<spec-number>-<short-slug>.md`.
2. Read the spec from that saved file, not from a one-off attachment only.
3. Check the current GitHub repo state first when the local workspace may be stale.
4. Implement the change against the real project state.
5. Push to `main`.
6. Wait for staging to auto-deploy.
7. Verify on staging.
8. Production is promoted manually on Render only after staging sign-off.

## Non-Negotiable Rules

- Do not treat localhost as the final approval surface for design-heavy or UI-heavy work.
- Do not assume the current Codex folder is a real git checkout.
- Do not ask the user to re-explain the standard workflow if the docs already answer it.
- Do not treat production as the first place to inspect a new UI change.
- Do not store new runtime-write paths outside `DATA_DIR`.

## Git And Environment Reality

- Shell Git and GitHub connector access are separate.
- If shell Git says `fatal: not a git repository`, this folder is a snapshot, not a real checkout.
- If shell Git says `Could not resolve host: github.com`, that is a shell network or DNS restriction, not automatically a GitHub auth issue.
- If the GitHub connector is working, prefer it for reading and updating the real repo when shell Git networking is blocked.
- The fallback local shell-git worktree is `/Users/jalduaij/Documents/Codex/influencer-hub-shell`.

## Resume After A Long Gap

If the project has been idle for weeks or months, do this in order:

1. Read this file.
2. Read `launch-ops-summary.md`.
3. Read `staging-deployment.md`.
4. Read the current spec in `for-codex/`.
5. Confirm whether GitHub connector access is working.
6. Confirm whether staging is healthy before approving UI work.

## Spec Hygiene

- Every new spec must be saved into `for-codex/`.
- If a spec changes deployment behavior, update:
  - `project-memory.md`
  - `launch-ops-summary.md`
  - `staging-deployment.md`
  - `go-live-checklist.md` when launch steps change
- Attached or pasted specs are not enough on their own; they must become a repo file path.

## Approval Surface Rules

- UI design approval happens on staging.
- Localhost is acceptable for isolated debugging, reproduction, or smoke testing.
- If local visuals differ from staging, staging wins.

## Production Rules

- Production URL is `https://club.pick.com.kw`.
- Production deploys are manual only.
- Never describe production as auto-deploying from `main`.
- If a spec includes a migration or one-time script, stage it first, then repeat it on production only if the spec says so.

## Launch-Window Behavior

Because launch is close, optimize for:

- short path to the right source of truth
- fast reproduction
- staging-first verification
- explicit rollout notes
- updating docs in the same pass as workflow changes

If a future session starts cold, this file should be enough to restore the working model quickly.
