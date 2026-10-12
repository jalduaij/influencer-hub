# Campaign Applicable Member Broadcast CSV

## Goal

Allow admins and campaign managers to download a campaign-scoped CSV for inviting every active member to whom the campaign currently applies.

## Requirements

- Add an **Export broadcast CSV** action to the campaign view.
- Restrict the export to authenticated admins and campaign managers.
- Export the same member audience represented by **Send to specific influencers**, without the UI's 50-member preview limit.
- Export only platform members who:
  - have an active influencer account;
  - have a valid stored mobile number;
  - match the campaign's current status, deadline, location, category, gender, follower, platform, and tag targeting; and
  - have not already joined the campaign with a non-canceled participation.
- Exclude offline reservations, already joined members, non-matching members, and pending, rejected, or suspended accounts.
- Produce UTF-8 CSV with the exact columns `mobile`, `name`, and `message`.
- Keep mobile numbers in international Kuwait format (`+965XXXXXXXX`).
- Personalize each invitation message with the member's first name.
- Use the campaign's configured WhatsApp body, or the existing generated campaign invitation when the configured body is empty.
- Append the campaign deep link to every message.
- Localize the greeting, default message, and link label using the manager's current English or Arabic interface locale.
- Return a useful campaign-specific filename.
- When there are no applicable members, return a valid header-only CSV.

## Verification

- An admin or campaign manager can export an active member matching the campaign who has not joined.
- A member who already joined the campaign is excluded.
- A member who does not match campaign targeting is excluded.
- A member cannot access the export endpoint.
- The CSV includes the expected filename and `text/csv` content type.
- The mobile number includes `+965`, the full name is present, and the message contains the personalized greeting, configured campaign body, and deep link.
- Suspending an applicable member removes them from the export; reactivating them restores eligibility.
- Static checks confirm the campaign UI exposes the corrected export action and sends the current locale.
