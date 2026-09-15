# Spec 109 — RTL mobile sidebar fix

Reproduces on production and staging today: on mobile (≤1180px), switching the app to Arabic (`العربية`) leaves the sidebar visible as a floating panel in the middle-right of the screen instead of being hidden off-screen. When the burger is tapped, the sidebar snaps flush against the physical **left** edge instead of the right — wrong for the natural RTL direction.

## Root cause

Two things combined:

1. `<html lang="en">` in `index.html` has no `dir` attribute. Only `<body>` gets the `.rtl` class toggled via `client.js` (`render()`, ~line 2545). The initial containing block used by `position: fixed` elements therefore has an **LTR** direction.
2. The mobile sidebar block in `styles.css` (~lines 2327–2352) uses **logical properties** `inset-inline-start` / `inset-inline-end`. On `position: fixed` elements these resolve inconsistently in browsers when the ICB direction disagrees with the element's inherited direction, and in practice the RTL override anchors the sidebar to the wrong physical edge and then translates it +280px, leaving a ~95px strip visible in the middle of a 375px viewport.

Two fixes, both small, both required to be safe:

- **CSS fix:** rewrite the mobile sidebar with physical `left` / `right`. Physical properties are unambiguous — every browser treats them identically regardless of any writing-mode context.
- **JS fix:** also set `<html dir="rtl">` when Arabic is selected. This is defense in depth — it hardens every other logical property in the app against the same class of bug and improves screen-reader behavior.

Scope: `styles.css`, `client.js`, `index.html`. No server changes, no data changes.

---

## 1. `styles.css` — replace the mobile sidebar block

Find the `@media (max-width: 1180px)` block that begins around **line 2305**. Replace the `.sidebar`, `.rtl .sidebar`, and `.app-shell.mobile-nav-open .sidebar` rules (~lines 2327–2352) with the version below. Leave everything else in that media query untouched — including `.mobile-topbar`, `.brand-mascot--sidebar { display: none }`, `.mobile-nav-backdrop`, and the grid overrides.

```css
  .sidebar {
    position: fixed;
    inset-block: 0;
    left: 0;
    right: auto;
    width: 280px;
    max-width: 85vw;
    min-height: 100vh;
    transform: translateX(-100%);
    transition: transform 220ms ease;
    z-index: 50;
    overflow-y: auto;
    background: linear-gradient(180deg, rgba(74, 31, 93, 0.98), rgba(47, 19, 61, 1));
    border-radius: 0;
    box-shadow: 4px 0 20px rgba(15, 23, 42, 0.18);
  }

  .rtl .sidebar {
    left: auto;
    right: 0;
    transform: translateX(100%);
    box-shadow: -4px 0 20px rgba(15, 23, 42, 0.18);
  }

  .app-shell.mobile-nav-open .sidebar {
    transform: translateX(0);
  }
```

Only three semantic changes:

- `inset-inline-start: 0` → `left: 0` (base), with an explicit `right: auto` reset.
- `inset-inline-start: auto; inset-inline-end: 0` → `left: auto; right: 0` (RTL override).
- Kept `transform: translateX(100%)` on `.rtl .sidebar` and the universal `translateX(0)` on `.mobile-nav-open` — those already work correctly once the anchor edges are physical.

Do **not** touch the `@media (min-width: 1181px)` block (~line 2451) that does `.sidebar { transform: none !important; position: static; }`. That's the desktop reset and is unaffected.

## 2. `client.js` — set `<html dir>` alongside the body class

Find the line in `render()` (around line 2545):

```js
document.body.classList.toggle("rtl", state.locale === "ar");
```

Add immediately after it:

```js
document.documentElement.setAttribute("dir", state.locale === "ar" ? "rtl" : "ltr");
document.documentElement.setAttribute("lang", state.locale === "ar" ? "ar" : "en");
```

Setting `dir` on the root element makes the ICB direction agree with the body direction, so `inset-inline-*` and other logical properties on fixed / absolute descendants behave the same as when they're on flow-positioned descendants. It also lets Safari/VoiceOver announce the page in the correct reading order.

`lang` on the root element mirrors the current locale so screen readers pronounce the right language. Small win, ships in the same one-line edit.

## 3. `index.html` — cache-bust

Bump both query strings so no user is served the old cached `styles.css` / `client.js`:

```html
<link rel="stylesheet" href="/styles.css?v=20260915-rtl-sidebar-109" />
<script src="/client.js?v=20260915-rtl-sidebar-109" defer></script>
```

Also — since we're now setting `<html dir>` at runtime, the static `dir="ltr"` implied by omission is fine to leave; JS overrides it on first `render()`. No change needed to the `<html>` tag itself. If you want a nicety, add a matching default:

```html
<html lang="en" dir="ltr">
```

Not required.

## 4. Smoke test (before pushing)

Run these on staging in a mobile-emulated viewport (Chrome DevTools iPhone 12/13 works, or real device):

1. Sign in as any role. Confirm English mobile: burger visible, sidebar hidden. Tap burger → sidebar slides in from the **left**. Tap backdrop → slides out to the left. No visual regression.
2. Switch to `العربية` via the sidebar language picker. **Sidebar must be fully hidden** — no floating strip anywhere, no overlap with page content.
3. Tap burger in Arabic → sidebar slides in from the **right**, flush against the right edge. Nav chips read RTL. Tap backdrop → slides out to the right.
4. Rotate landscape ↔ portrait in Arabic — sidebar stays correctly hidden closed, and correctly right-flush open.
5. In DevTools, inspect `<html>` — should have `dir="rtl"` and `lang="ar"` while Arabic is active, `dir="ltr"` and `lang="en"` while English is active.
6. Switch language back and forth several times — no lingering artifacts, no scroll jump, no stuck backdrop.
7. Desktop width (≥1181px): sidebar is static, nothing about this spec changes desktop behavior.
8. Test on an actual iPhone in Safari and an Android in Chrome if possible. This class of bug historically differs between browser engines.
9. Member scope (influencer login): mobile RTL sidebar should also be correctly positioned. `body.member-scope.rtl .sidebar` styles at line ~5639 only affect borders and shadows — no positional overrides — so the physical `left`/`right` fix carries through cleanly.

## 5. What this spec does NOT do

- Does not refactor other `inset-inline-*` usages elsewhere in `styles.css` to physical properties. There are two other spots (~lines 4315 and 4657) that use `inset-inline-*` with `!important` for notification positioning; those already work because they're paired correctly for the current containing blocks. Leave them.
- Does not change desktop sidebar behavior at all.
- Does not touch the mobile-topbar, burger, or backdrop markup / behavior.
- Does not add any new component. Purely a positional bug fix.

## 6. Promote checklist

Client-only. No migration. Very low risk — physical properties are the safest positioning primitive.

1. Codex pushes → staging auto-deploys.
2. Jassem walks through smoke test 1–9 on staging (mobile + desktop, both locales).
3. Manual Deploy production on `pick-social-club`.
4. Hard-refresh production on a mobile device to bust cache, verify Arabic mobile behavior.

Push when ready.
