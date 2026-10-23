# Phone number and password login

Release 1.4.17, authorized for GitHub Pages deployment on 2026-10-22, extending accepted 1.4.16.

## Account management — 1.4.19

Brian now provisions phone-only accounts and updates phone numbers/passwords in `ui-accounts.html`. The backend uses the supported Auth Admin API; no local secret-key command is needed for routine administration. Adding or changing a number requires Brian to confirm it belongs to the user. Brian can update his own credentials and then signs in again; he cannot delete himself or demote his role. If Brian cannot sign in, recovery still requires an authorized Supabase administrator.

The original rollout notes below are historical and do not describe the current account inventory.

## Original rollout status — 2026-10-22

- Phone authentication is enabled. Email authentication remains enabled in Supabase, but the new application form accepts phone numbers only.
- The finance owner's existing Auth account has a saved, confirmed phone number. Its UUID, active dispatcher profile, and password remain in place.
- The other four existing accounts still need phone numbers. The owner explicitly authorized deploying now and will configure those credentials later. Their records remain intact; these accounts cannot use the new phone-only form until configured.
- A successful live phone/password sign-in has not yet been verified. The owner will test the deployed page using the existing password; no password or secret key is included in this repository.

## Login behavior

- The form accepts a mobile phone number and the existing password. It uses Supabase `signInWithPassword({phone,password})`; it sends no OTP and creates no accounts.
- Taiwan `09xxxxxxxx` input is normalized to `+8869xxxxxxxx`. Explicit international `+` numbers are accepted. Store phone numbers in international format in Supabase Auth.
- Successful sign-in still loads the matching `profiles` row by the authenticated user UUID, requires an active driver/dispatcher, and opens daily attendance. All dashboard permissions and Brian's finance binding remain unchanged.
- There is no email fallback on this proposed login page. Email addresses are not synthesized from phone numbers.

## Account setup

At the initial read-only preflight, phone authentication was disabled and none of the five accounts had a phone number. The rollout status above supersedes that preflight. Complete the following provisioning steps for each account that needs phone login.

1. Enable the Phone provider. This is complete for the connected project, via the Management API's `external_phone_enabled` setting. Provider configuration is separate from a database migration and is not changed by the GitHub workflow.
2. Add each verified phone number to the **existing Auth user**, using an authorized Supabase Auth administration flow. Preserve every Auth UUID and its existing `profiles` row; do not delete/recreate users or directly patch managed Auth tables with SQL.
3. Confirm phone ownership as part of administrator provisioning, or use Supabase's SMS verification flow. Do not turn off confirmation globally just to get past an unconfirmed account. Sending SMS requires a configured SMS provider; routine phone/password sign-in does not send a text.
4. Keep existing passwords. An administrator-created new user needs a phone number and password and must have its corresponding `profiles` row configured, just as before. The Auth Admin API supports phone-only creation through `createUser({phone,password,phone_confirm:true})` after the administrator has verified the number. That API is server-only; never add a service-role key to this GitHub Pages app.
5. After provisioning, sign in through the application with that account's phone number and existing password. Use the owner's own browser or the secure browser credential flow; never send credentials through chat. The owner authorized the initial deployment while the remaining four accounts await provisioning.

The current Supabase Dashboard's standard Create User form requires an email and does not provide phone-only provisioning. Use the supported Auth Admin API to add phone numbers to existing accounts or create phone-only accounts. Run privileged administration from a trusted local tool or backend with a project secret key; never embed that key in the GitHub Pages application. No email alias is required.

The current five-account phone mapping is intentionally not stored in source control. Do not publish phone lists or passwords in issues, PRs, fixtures or static assets. Account creation and password resets are administrator-managed; there is no public sign-up or recovery flow.

## Validation

`npm run test:login` covers local/international formatting, phone-only Auth payloads, invalid input, inactive/missing/unknown-role profiles, authentication failures, network recovery and duplicate submission prevention. These are mocked Auth tests, not a successful live phone sign-in.

References:
- https://supabase.com/docs/guides/auth/passwords#with-phone
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
