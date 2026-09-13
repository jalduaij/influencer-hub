# Spec 108 — Hide campaign from influencers

Fixes a real problem discovered pre-launch: when admin/CM deactivates a campaign — including test/duplicate/cleanup campaigns that should never have been visible — every joined influencer sees a "Canceled" card in their history and receives a "Canceled campaign assignments" notification. There is no way to clean up without leaking negative signal.

Root cause: `deactivated` is doing two jobs — "we called it off, tell everyone" and "make this go away." This spec separates them by adding an independent visibility flag `hiddenFromInfluencers`, orthogonal to status. Admin/CM keeps full audit. Influencers see nothing.

**Scope:** `server.js`, `client.js`, `styles.css`. **No schema migration.** New boolean field `campaign.hiddenFromInfluencers` defaults to `false` for every existing record and is treated as `false` when absent. Store format stays JSON.

**Non-goals:** hard deletion of campaigns (deferred post-launch), renaming existing statuses, changing what `deactivated` does to participants (still cancels them), building a shared empty-state helper.

---

## 1. Data model — one new boolean

`campaign.hiddenFromInfluencers` — boolean, defaults to `false`. No migration needed; reads use `Boolean(campaign.hiddenFromInfluencers)`.

Include in `serializeCampaign` (`server.js` ~line 1914) so both admin and influencer bootstraps carry the flag:

```js
const serialized = {
  ...campaign,
  hiddenFromInfluencers: Boolean(campaign.hiddenFromInfluencers),
  codeStats: codeStatsForCampaign(store, campaign.id),
  ...
```

Also include in `serializePreviewCampaign` for symmetry (not strictly required but keeps the shape consistent).

## 2. Helper — one place that decides "influencer can see this"

At the top of `server.js`, near `campaignById`, add:

```js
function isHiddenFromInfluencers(campaign) {
  return Boolean(campaign && campaign.hiddenFromInfluencers);
}
```

Every filter below uses this. Do not inline the check — we want one canonical place to change the rule.

## 3. Server — filter the influencer bootstrap

Currently `buildBootstrap` sends `store.campaigns.map(serializeCampaign)` in the shared `common` block, meaning every influencer receives the full campaign catalog and client code filters. That still works, but Hidden campaigns should not leave the server at all for an influencer role.

In `buildBootstrap` (`server.js` around line 2464), branch on role:

```js
const visibleCampaigns = user.role === "influencer"
  ? store.campaigns.filter((campaign) => !isHiddenFromInfluencers(campaign))
  : store.campaigns;

const campaigns = visibleCampaigns.map((campaign) =>
  serializeCampaign(store, campaign, { includeVerificationPassword })
);
```

Then also filter the influencer's own participants at the point they're built (`server.js` around line 2493 — the `myParticipants` map):

```js
const myParticipants = store.participants
  .filter((participant) => participant.influencerId === user.id)
  .filter((participant) => {
    if (user.role !== "influencer") return true;
    const campaign = campaignById(store, participant.campaignId);
    return !isHiddenFromInfluencers(campaign);
  })
  .map((participant) => serializeParticipantForRequest(participant));
```

Also filter `previewCampaigns` (line ~2505) — Hidden campaigns should never appear as a coming-soon teaser either:

```js
previewCampaigns: store.campaigns
  .filter((campaign) => campaign.status === "draft" && campaign.previewMode === true && !isHiddenFromInfluencers(campaign))
  .sort(...)
```

`eligibleCampaignIds` is derived from `eligibleCampaignsFor(store, user)`. Inside that function, add the Hidden filter for influencer role. If the helper is shared with admin/CM logic, guard by role there too.

## 4. Server — retract the "Canceled campaign assignments" notification

The notification at `server.js:2419` is computed dynamically:

```js
const canceled = store.participants.filter(
  (participant) => participant.influencerId === user.id && participant.status === "canceled"
);
```

Filter Hidden campaigns out of it — a Hidden campaign's canceled participation should not trigger this notification:

```js
const canceled = store.participants.filter((participant) => {
  if (participant.influencerId !== user.id) return false;
  if (participant.status !== "canceled") return false;
  const campaign = campaignById(store, participant.campaignId);
  return !isHiddenFromInfluencers(campaign);
});
```

This is the "retraction" — no DB write, just no longer surfaced.

## 5. Server — allow toggling from the existing edit endpoint

The campaign edit handler already does `Object.assign(campaign, payload, ...)` (around line 3782 of `server.js`). Add `hiddenFromInfluencers` to the whitelist of accepted payload keys wherever the current whitelist lives; if the current code accepts arbitrary keys via spread, coerce the value:

```js
if ("hiddenFromInfluencers" in payload) {
  campaign.hiddenFromInfluencers = Boolean(payload.hiddenFromInfluencers);
}
```

Emit an audit event on any toggle:

```js
if (previousHidden !== campaign.hiddenFromInfluencers) {
  appendAuditEvent(store, actor, campaign.hiddenFromInfluencers ? "campaign.hidden_from_influencers" : "campaign.unhidden_from_influencers", "campaign", campaign.id, {
    previous: previousHidden,
    next: campaign.hiddenFromInfluencers,
  });
}
```

(Capture `previousHidden` at the top of the handler before the `Object.assign`, same pattern as `previousStatus` and `previousVerificationPassword` already do.)

## 6. Client — form field on the campaign edit page

`client.js` around line 4626 (the Status `<select>`). Add a new field *inside* the same `form-grid two-col` block, sitting right after the Status select — visually paired with it since they're both "who sees this":

```js
<label class="field field-span-full">
  <span>${l("Hide from influencers", "إخفاء عن المؤثرين")}</span>
  <div class="row-wrap">
    <label class="choice-pill">
      <input type="checkbox" name="hiddenFromInfluencers" value="1" ${campaign?.hiddenFromInfluencers ? "checked" : ""} />
      <span>${l("Yes — remove from every influencer's view", "نعم — إخفاؤها من كل واجهات المؤثرين")}</span>
    </label>
  </div>
  <small>${l(
    "Hidden campaigns disappear from influencers' Campaigns, History, and notifications. Admins and campaign managers still see everything. Reversible.",
    "تختفي الحملات المخفية من قائمة المؤثرين وسجلاتهم وإشعاراتهم. يظل المديرون ومديرو الحملات يرون كل شيء. قابل للاستعادة."
  )}</small>
</label>
```

`previewMode` and this checkbox both take `value="1"` so the existing form submit code path (which likely coerces to a boolean the same way) works with no plumbing changes. Confirm at the submit site — if `previewMode` becomes `true` via a `=== "1"` check, mirror that; if it uses `Boolean(payload.previewMode)`, mirror that.

## 7. Client — badge on the campaign list & campaign view for admin/CM

Admin and CM keep seeing Hidden campaigns everywhere. To distinguish them at a glance, add a small badge next to the status pill on:

1. Admin campaigns list table (the row where status is currently rendered).
2. Campaign detail view header.
3. Reports → Campaigns table.

Reuse the existing `.badge` styling; add a `.badge--muted` variant if needed:

```js
${campaign.hiddenFromInfluencers ? `<span class="badge badge--muted" title="${l("Not visible to influencers", "غير مرئية للمؤثرين")}">${l("Hidden", "مخفية")}</span>` : ""}
```

Keep it visually distinct from the status pill — the point is "this campaign has an admin-only wrapper on it," not "this is a status."

## 8. Client — nothing else needs to change

Because the server strips Hidden campaigns from influencer bootstraps entirely, the client-side `eligibleCampaigns()`, member campaign page, history section, and notification bell all work correctly without changes. Do a final grep confirming that no influencer-facing surface reads `state.data.campaigns` for a Hidden campaign — if any does, it will simply not find the row (already filtered) and no-op.

## 9. CSS — one variant

`styles.css`, near the existing `.badge` rules:

```css
.badge--muted {
  background: rgba(112, 47, 138, 0.08);
  color: rgba(74, 31, 93, 0.72);
  border: 1px solid rgba(112, 47, 138, 0.16);
}
```

Colors match the existing purple palette. Adjust to the token names in your `:root` if we've formalized them by then.

## 10. Smoke test (before pushing)

1. Sign in on staging as admin → open the Watermelon Mojito Cup campaign edit page → check the new "Hide from influencers" checkbox → save. Confirm the badge appears next to the status pill on the campaigns list and on the campaign view.
2. Sign in as Essa (the influencer who has a submitted proof on that campaign) → Campaigns page: the campaign is gone from every section (In Play, Open, History). Notification bell: no "Canceled campaign assignments" card. My Submissions: no reference to that campaign.
3. Sign back in as admin → uncheck "Hide from influencers" → save. Sign in as Essa again → campaign and history entry reappear exactly as before.
4. Create a fresh test campaign → set status to `deactivated` immediately → check "Hide from influencers" in the same save → sign in as an influencer who would have been eligible. They see nothing. No notification.
5. Confirm the audit log shows `campaign.hidden_from_influencers` with the actor.
6. Confirm CM (Reem) can toggle the flag on campaigns she manages, same UX as admin.
7. Reports (admin): Hidden campaigns still appear in every report tab — Campaigns, Influencers (their participation rows), Submissions, Codes. Hidden ≠ deleted.
8. Arabic locale: checkbox label, hint copy, and badge all render in Arabic.
9. Previously canceled participants on the Hidden campaign still exist in the DB (grep `store.json`) — nothing was destroyed.

## 11. What this spec does NOT do

- Does not add hard delete. Cleanup of drafts-with-zero-participation is a separate future spec (guarded by no participants + no codes + no submissions).
- Does not rename `deactivated`. A deactivated campaign still shows "Canceled" to already-joined influencers unless it's ALSO Hidden. This is intentional — the two flags mean different things.
- Does not add a "Hidden" filter chip to the admin campaigns list. If needed post-launch, one-liner.
- Does not touch code redemption records. If an influencer used a code on a now-Hidden campaign, the redemption line in their code wallet stays — but the campaign name link becomes inert (no route to the hidden campaign). Acceptable for launch; can be polished later.
- Does not send an outgoing notification when a campaign is Hidden — the whole point is silence.

## 12. Promote checklist

Server + client. No migration. Low risk. Reversible per-campaign.

1. Codex pushes → staging auto-deploys.
2. Walk through smoke test 1–9 on staging.
3. Manual Deploy production on `pick-social-club`.
4. On production: for the current live campaigns, decide per-campaign whether any of them should be Hidden right now (probably none — this is a tool for future cleanup and mistakes).

Push when ready. Jassem verifies staging, then walks through the production promote.
