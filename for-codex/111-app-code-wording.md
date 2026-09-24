# Spec 111 — App code wording

## Goal

Make the self-redemption option work for any third-party ordering or pickup app without implying that it is limited to delivery.

## Copy changes

- Call the influencer-facing code an `App code` in English and `كود التطبيق` in Arabic.
- Label the campaign option `App code redemption` in English and `استخدام كود التطبيق` in Arabic.
- Refer generically to entering the code in an app or at checkout.
- Remove delivery-specific wording from this feature's campaign and member interfaces.

## Constraints

- Keep the existing checkbox behavior, APIs, persistence fields, audit behavior, and cancellation safeguards unchanged.
- Keep the standard QR and cashier-password flow unchanged.
- Do not change unrelated physical delivery-address wording.
