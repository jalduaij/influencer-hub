# PICK Social Club Agent Guardrails

## Mandatory startup check

- Treat this repository as the PICK Social Club / influencer hub project.
- Before answering questions about the app, inspect the repository status and read `project-memory.md`.
- For deployment or production questions, also read `launch-ops-summary.md` and `staging-deployment.md`.
- Confirm that the Git remote points to `jalduaij/influencer-hub` and verify GitHub `main` when the local checkout may be stale.

## Never confuse code, tasks, and runtime data

- Never conclude that the app or its campaign data is missing merely because a local folder is empty, stale, or detached.
- Runtime campaign data is stored on Render's persistent `DATA_DIR`; it is separate from local source files and Codex task history.
- If the current directory does not contain the app files or the expected Git remote, inspect the saved Codex projects and the pinned task named `Build influencer campaign app` before answering.

## Sources of truth

Use this order when information conflicts:

1. GitHub `jalduaij/influencer-hub` on `main` for code.
2. Render staging at `https://pick-influence-hub-stage.onrender.com` for UI and behavior approval.
3. The current local checkout for implementation.
4. Historical local snapshots only as fallbacks.

The canonical production URL is `https://club.pick.com.kw`. Staging auto-deploys from `main`; production deploys manually only after staging sign-off.

## Known local locations

- Active saved project checkout: `/Users/jalduaij/Documents/ChatGPT/Social Club`
- Historical full snapshot: `/Users/jalduaij/Documents/Codex/2026-04-19-i-need-influencer-management-system-a`
- Older shell Git fallback: `/Users/jalduaij/Documents/Codex/influencer-hub-shell`

If a future task starts in the wrong location, report the mismatch explicitly and switch to or verify against GitHub `main`; do not describe the project itself as empty.
