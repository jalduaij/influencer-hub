# Campaign Subscriber Broadcast CSV

## Goal

Allow admins and campaign managers to download a campaign-scoped CSV for an external message-broadcast system.

## Requirements

- Add an **Export broadcast CSV** action to the campaign view.
- Restrict the export to authenticated admins and campaign managers.
- Export only platform members who:
  - have an active influencer account;
  - have a non-canceled participation in the selected campaign; and
  - have a valid stored mobile number.
- Exclude offline reservations, canceled participations, and pending, rejected, or suspended accounts.
- Deduplicate members if historical participation records exist.
- Produce UTF-8 CSV with the exact columns `mobile`, `name`, and `message`.
- Keep mobile numbers in international Kuwait format (`+965XXXXXXXX`).
- Personalize each message with the member's first name.
- Use the campaign's configured WhatsApp body, or the existing generated campaign message when the configured body is empty.
- Append the campaign deep link to every message.
- Localize the greeting, default message, and link label using the manager's current English or Arabic interface locale.
- Return a useful campaign-specific filename.
- When there are no eligible subscribers, return a valid header-only CSV.

## Verification

- An admin or campaign manager can export an eligible active subscriber.
- A member cannot access the export endpoint.
- The CSV includes the expected filename and `text/csv` content type.
- The mobile number includes `+965`, the full name is present, and the message contains the personalized greeting, configured campaign body, and deep link.
- Canceled duplicate participation records do not create duplicate rows.
- Suspending the subscribed member removes them from the export; reactivating them restores eligibility.
- Static checks confirm the campaign UI exposes the export action and sends the current locale.
