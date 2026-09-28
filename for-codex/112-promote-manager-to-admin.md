# Promote Campaign Manager to Admin

## Goal

Allow an existing admin to promote an active campaign manager account to an admin account without recreating the user or changing their credentials.

## Requirements

- Add a **Promote to admin** action to the campaign manager edit page.
- Explain that promotion grants full system access and is not reversible from the dashboard.
- Require a browser confirmation before sending the promotion request.
- Restrict the endpoint to authenticated admins.
- Only active users whose current role is `campaign_manager` may be promoted.
- Preserve the user's ID, login credentials, profile data, and campaign ownership/history.
- Record who promoted the account, when it happened, and an audit event containing the old and new roles.
- After promotion, remove the account from the campaign manager list and return to that list.
- Existing sessions for the promoted user must receive admin permissions on their next request.

## Verification

- A campaign manager cannot promote themselves or another manager.
- An admin can promote an active campaign manager.
- A suspended manager cannot be promoted until reactivated.
- Repeating the promotion is rejected.
- The promoted user's existing authenticated session sees `role: admin` without requiring a new account.
- The audit log contains the promotion event.
