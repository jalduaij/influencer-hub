# Spec 110 — Delivery self-redemption codes

## Goal

Allow a campaign manager to create a delivery/online campaign where the assigned third-party coupon code is shown directly to the influencer, without changing the existing branch QR and cashier-password flow for normal campaigns.

## Campaign setting

Add a bilingual checkbox to the campaign create/edit form:

- EN: `Delivery / online redemption — show the assigned code to the influencer`
- AR: `استخدام للتوصيل / أونلاين — اعرض الكود المخصص للمؤثر`

Persist the setting as the optional boolean `selfRedeemCode`. Existing campaigns default to `false`.

## Server behavior

- Continue using the current uploaded code pool and automatic one-code-per-participant reservation.
- Managers and admins continue to receive assigned code values.
- An authenticated influencer receives the raw assigned code only when:
  - the participant belongs to that influencer;
  - the campaign has `selfRedeemCode: true`; and
  - the participation is not canceled.
- Standard campaigns continue hiding the raw code and using the signed QR/reference flow.
- If an influencer cancels a self-redemption participation, block the code instead of returning it to the available pool. A code that may have been copied must never be reassigned.
- Record an audit event when the campaign setting changes.

## Influencer UI

For a self-redemption campaign:

- Show the assigned code clearly after the influencer joins.
- Provide a Copy code action.
- Explain that the code should be entered at checkout in the delivery app.
- Replace branch, cashier, QR, and reference instructions with delivery/online instructions.
- Keep the existing QR experience unchanged for all other campaigns.
- Use bilingual English and Arabic copy.

## Verification

- Existing campaigns default to the QR/cashier flow.
- A self-redemption campaign round-trips the new setting through create/edit/bootstrap.
- Its assigned influencer receives the raw code; another influencer cannot retrieve it.
- Standard campaign participants still do not receive raw codes.
- Canceling a self-redemption participation blocks its code; canceling a standard participation still releases its code.
- Syntax and smoke tests pass.

## Rollout

This is a code-only, backward-compatible field addition. No runtime migration or production data rewrite is required.
