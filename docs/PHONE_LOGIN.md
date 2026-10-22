# Phone number and password login — 1.4.17 rollout

Prepared on 2026-10-22. The accepted live release remains 1.4.16 until account setup is complete.

## Login behavior

- The form accepts a mobile phone number and the existing password. It uses Supabase `signInWithPassword({phone,password})`; it sends no OTP and creates no accounts.
- Taiwan `09xxxxxxxx` input is normalized to `+8869xxxxxxxx`. Explicit international `+` numbers are accepted. Store phone numbers in international format in Supabase Auth.
- Successful sign-in still loads the matching `profiles` row by the authenticated user UUID, requires an active driver/dispatcher, and opens daily attendance. All dashboard permissions and Brian's finance binding remain unchanged.
- There is no email fallback on this proposed login page. Email addresses are not synthesized from phone numbers.

## Required setup before merging / deploying

At the read-only preflight, the connected project had phone authentication disabled and none of its five active accounts had a phone number. Deploying the phone-only form in that state would prevent all five accounts from signing in.

1. Enable the Phone provider in Supabase Authentication settings. This is separate from a database migration and is not changed by the GitHub workflow.
2. Add each verified phone number to the **existing Auth user**, using an authorized Supabase Auth administration flow. Preserve every Auth UUID and its existing `profiles` row; do not delete/recreate users or directly patch managed Auth tables with SQL.
3. Confirm phone ownership as part of administrator provisioning, or use Supabase's SMS verification flow. Do not turn off confirmation globally just to get past an unconfirmed account. Sending SMS requires a configured SMS provider; routine phone/password sign-in does not send a text.
4. Keep existing passwords. An administrator-created new user needs a phone number and password and must have its corresponding `profiles` row configured, just as before. The Auth Admin API supports phone-only creation through `createUser({phone,password,phone_confirm:true})` after the administrator has verified the number. That API is server-only; never add a service-role key to this GitHub Pages app.
5. Confirm Brian and the other existing users are ready; perform a legitimate phone/password sign-in test through the secure browser credential flow. Then merge this branch and let the normal GitHub Pages workflow deploy.

The current five-account phone mapping is intentionally not stored in source control. Do not publish phone lists or passwords in issues, PRs, fixtures or static assets. Auth account creation and password recovery remain administrator-managed; this change adds no public sign-up or recovery flow.

## Validation

`npm run test:login` covers local/international formatting, phone-only Auth payloads, invalid input, inactive/missing/unknown-role profiles, authentication failures, network recovery and duplicate submission prevention. These are mocked Auth tests, not a successful live phone sign-in.

References:
- https://supabase.com/docs/guides/auth/passwords#with-phone
- https://supabase.com/docs/reference/javascript/auth-signinwithpassword
- https://supabase.com/docs/reference/javascript/auth-admin-createuser
- https://supabase.com/docs/reference/javascript/auth-admin-updateuserbyid
