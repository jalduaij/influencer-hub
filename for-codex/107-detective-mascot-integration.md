# Spec 107 — Detective mascot integration

We now have a character mascot for PICK Social Club — a purple detective / spy holding out a slice, single-color silhouette style. This spec integrates it into the app in five places:

1. **Login page** — hero above the wordmark.
2. **Dashboard sidebar** — mascot corner at the bottom of the sidebar, above the user card.
3. **Empty states** — muted mascot on empty campaign / member / submissions lists.
4. **Favicon + tab icon** — cropped to the hat + eyes.
5. **Brand color** — audit / unify around the mascot's `#663084`.

**Assets (both shipped with this spec):**
- `logo.svg` — original artwork, fill `#663084` on white. Use on light backgrounds.
- `logo-light.svg` — same paths with the purple fill swapped to `#fbf7ff`. Use on the dark purple sidebar and other purple surfaces. Ships in this PR — do not regenerate.

Scope: `client.js`, `styles.css`, `index.html`, `server.js` (route additions only), plus the two SVG files. **No data model changes. No new endpoints beyond static file routes.**

---

## 1. Ship the SVG assets

Drop both files at the repo root (same directory as `styles.css` and `client.js` — the server already serves that directory piecewise, so we'll just add two more explicit routes):

- `logo.svg`
- `logo-light.svg`

Both files are attached to this spec. Do not modify them.

Then in `server.js`, right below the existing `/client.js` route (around line 3269), add:

```js
if (req.method === "GET" && pathname === "/logo.svg") return serveFile(res, path.join(ROOT, "logo.svg"));
if (req.method === "GET" && pathname === "/logo-light.svg") return serveFile(res, path.join(ROOT, "logo-light.svg"));
if (req.method === "GET" && pathname === "/favicon.svg") return serveFile(res, path.join(ROOT, "favicon.svg"));
if (req.method === "GET" && pathname === "/favicon.ico") return serveFile(res, path.join(ROOT, "favicon.ico"));
```

Also add each new route to `isStaticOnlyRequest` (line 3280) so they bypass the store lock:

```js
p === "/logo.svg" ||
p === "/logo-light.svg" ||
p === "/favicon.svg" ||
p === "/favicon.ico" ||
```

**Favicon:** create `favicon.svg` by cropping the top ~28% of `logo.svg` (just the hat + eyes) into a square viewBox. If you don't want to hand-craft the crop, do the simple version: `favicon.svg` is a copy of `logo.svg` with the viewBox tightened to `"140 40 420 300"` (hat and face region). Set `width="32" height="32"`. Also generate a fallback `favicon.ico` at 32×32 from the same crop.

## 2. Login page — hero above the wordmark

File: `client.js`, function `renderAuth` (line 1201).

Insert the mascot as the first child of `.login-card`, above the existing `<p class="eyebrow">PICK Internal</p>`:

```js
<article class="login-card">
  <div class="brand-mascot brand-mascot--login">
    <img src="/logo.svg" alt="" role="presentation" />
  </div>
  <p class="eyebrow">PICK Internal</p>
  <h1>${l("PICK Influence Hub", "منصة PICK لإدارة المؤثرين")}</h1>
  ...
```

`alt=""` + `role="presentation"` — the wordmark below already carries the accessible name. Screen readers should not read the mascot as text.

## 3. Dashboard sidebar — mascot corner at the bottom

File: `client.js`, function `renderShell` (line 1323).

The current sidebar structure is: `brand-block` → `control-panel` → `sidebar-nav` (flex:1) → `sidebar-footer`. `sidebar-nav` fills all available space, pushing `sidebar-footer` to the bottom.

Insert a mascot block **between** `sidebar-nav` and `sidebar-footer` (line 1355, right after the closing `</nav>`):

```html
<div class="brand-mascot brand-mascot--sidebar" aria-hidden="true">
  <img src="/logo-light.svg" alt="" />
</div>
<div class="sidebar-footer">
  ...
</div>
```

Use `logo-light.svg` here — the original purple mascot won't render on the purple sidebar background.

**Do NOT** touch `.brand-block` at the top — wordmark stays where it is. The mascot is a second brand anchor, not a replacement.

## 4. Empty states — muted mascot

File: `client.js`.

There isn't a single shared empty-state helper today; several tables render `"-"` or a small "No items" message inline. This spec **does not** refactor those into a single helper. Instead, add the mascot to the three highest-visibility empty states only:

1. **Campaigns list (admin/CM)** — when there are 0 campaigns.
2. **Members list (admin)** — when there are 0 members.
3. **Campaign view → Submissions table** — when there are 0 submissions.

Find each of those three empty-state renders and replace the placeholder text with:

```js
`<div class="empty-state">
  <div class="brand-mascot brand-mascot--empty">
    <img src="/logo.svg" alt="" role="presentation" />
  </div>
  <p class="empty-state-copy">${l("Nothing here yet.", "لا يوجد شيء هنا بعد.")}</p>
</div>`
```

Keep the exact copy per surface — e.g. "No campaigns yet" / "No members yet" / "No submissions yet" and their Arabic equivalents. Don't lose the specificity.

## 5. Favicon wiring in `index.html`

File: `index.html`. Add inside `<head>`, right after the viewport meta:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
<link rel="apple-touch-icon" href="/logo.svg" />
```

Also update the `<title>` if you want, but this spec doesn't require it.

## 6. CSS — add the mascot styles

File: `styles.css`. Add near the `.brand-block` / `.sidebar` rules (around line 149):

```css
.brand-mascot {
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none;
}

.brand-mascot img {
  display: block;
  height: auto;
  max-width: 100%;
}

/* Login hero — sits above the wordmark, centered */
.brand-mascot--login {
  margin: 0 auto 16px;
  width: 180px;
}

.brand-mascot--login img {
  width: 100%;
}

/* Sidebar corner — sits between nav and footer */
.brand-mascot--sidebar {
  margin: 20px auto 12px;
  width: 120px;
  opacity: 0.92;
}

.brand-mascot--sidebar img {
  width: 100%;
}

/* Empty states — larger + muted */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 32px 16px;
  text-align: center;
}

.brand-mascot--empty {
  width: 200px;
  opacity: 0.35;
}

.brand-mascot--empty img {
  width: 100%;
}

.empty-state-copy {
  margin: 0;
  color: var(--muted);
  font-size: 0.95rem;
}
```

**Mobile:** at `max-width: 720px` (or wherever the login-shell already collapses to single column — around line 1342), shrink `--login` to `140px` and hide `--sidebar` entirely if the mobile nav collapses the sidebar. Check what the existing mobile sidebar layout does; if the sidebar is still present at mobile, keep the mascot but at `90px`. If it turns into a top bar, drop the mascot.

Add:

```css
@media (max-width: 720px) {
  .brand-mascot--login { width: 140px; }
  .brand-mascot--sidebar { display: none; }  /* only if sidebar collapses; adjust otherwise */
}
```

## 7. Brand color audit — do this last, keep it small

The mascot's purple is `#663084`. The current sidebar/login-sidecard already uses `rgba(74, 31, 93, ...)` (roughly `#4A1F5D`) — close but not identical.

**Do NOT re-theme the whole app in this spec.** All this spec does on brand color:

1. Search `styles.css` for `#4A1F5D`, `74, 31, 93`, `47, 19, 61`, and similar violet values. **List** them in the PR description. Don't change them yet.
2. If a `--brand` or `--primary` CSS variable already exists, ensure it's set to `#663084` at the top of `:root`. If it doesn't exist, add `--brand: #663084;` to `:root` for future use.

Full palette unification is a future spec once we see the mascot in context and decide whether to shift the app purple toward `#663084` or keep the current `#4A1F5D` sidebar as an intentional darker frame around the lighter mascot purple.

## 8. Bump the cache-busting query params

`index.html` references `styles.css?v=...` and `client.js?v=...`. Bump both to `v=20260810-mascot-107` (or the next sequential value) so browsers don't serve the old cached versions.

## 9. Smoke test (before pushing)

1. On staging, go to `/` in a signed-out browser (private window is easiest).
2. **Login page**: mascot visible above the "PICK Internal" eyebrow. Not stretched. Not cut off. Wordmark still visible below it.
3. Toggle to Sign Up mode → mascot still there (it's outside the form area).
4. Toggle to Arabic (`العربية`) → mascot still centered and correctly sized in RTL.
5. Sign in as admin → land on dashboard.
6. **Sidebar**: mascot visible in white/light form at the bottom of the sidebar, above the user avatar card. Not overlapping the last nav chip. Not overlapping the user card.
7. Scroll a long dashboard page — the sticky sidebar keeps the mascot in view.
8. Sign in as an influencer with no campaigns yet (or in the CM view of an empty campaign) → **empty state** shows the muted mascot + copy.
9. Browser tab: favicon shows the cropped mascot (hat + eyes).
10. **Mobile width (≤720px)**: mascot shrinks on login; sidebar mascot behaves per whatever the sidebar does at that breakpoint.
11. Arabic locale + mobile — same checks.
12. Sign out → back to login → mascot still there (no lingering state, no re-fetch flicker).
13. Inspect network tab: `logo.svg` and `logo-light.svg` return 200 from the app origin (not from an unexpected 404 fallback).

## 10. What this spec does NOT do

- Does not repaint the entire app to `#663084`. Sidebar keeps its current darker purple gradient. That's the follow-up.
- Does not build a shared empty-state component. Only three surfaces get the treatment; the rest keep their current inline messages.
- Does not animate the mascot. No hover bounce, no wave, no eyes-follow-cursor. You explicitly said no animation.
- Does not add the mascot to every screen — no header repetition, no watermarks, no per-page hero. Just the five surfaces above.
- Does not touch RTL logic beyond making sure the mascot is centered in both directions (which the `margin: auto` handles).
- Does not add PWA manifest icons. That's a separate concern from the favicon and doesn't block launch.

## 11. Promote checklist

Client + minimal server (static routes only). Low risk.

1. Codex pushes → staging auto-deploys.
2. Sign in on staging → walk through smoke test above end-to-end.
3. Manual Deploy production on `pick-social-club`.
4. Hard-refresh the production URL to bust any cached `styles.css` / `client.js`.
5. Verify favicon in browser tab on production.

Push when ready. Jassem verifies staging, then walks through the production promote.
