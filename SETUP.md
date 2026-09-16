# UNLV Badminton configuration

The deployed site starts with an empty D1-backed queue. The explicitly labeled interactive demo uses fictional names and temporary component state; it never calls reservation write APIs and is reset on exit. Private publication is for owner review. Student launch still requires authentication configuration and an intentional audience change.

## Managed email authentication

Sites currently provides ChatGPT sign-in, which does not implement school email OTP. The school-email flow therefore uses the managed Supabase Auth HTTP API, not a locally generated or fixed code. No mail provider or Supabase project has been provisioned in this work.

Configure a Supabase project with Email Auth, custom SMTP suitable for student recipients, a six-digit email OTP template containing `{{ .Token }}` (both signup and magic-link templates), and a short OTP expiry (for example 10 minutes). Set the access-token lifetime to **14400 seconds** to supply the required four-hour session. This app deliberately does not refresh tokens; it accepts them only until the earlier of token expiry and issuance + 4 hours. A shorter provider lifetime will shorten the session and must be corrected before launch.

Official references:
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/auth/auth-email-templates
- https://supabase.com/docs/guides/auth/sessions

Set these runtime variables through Sites and redeploy:
- `SUPABASE_URL`: managed project HTTPS URL
- `SUPABASE_ANON_KEY`: publishable/anon API key (not service-role key)
- `SCHOOL_EMAIL_DOMAIN`: defaults to `unlv.nevada.edu`; confirm this is the intended student domain
- `ADMIN_EMAILS`: comma-separated school emails that bootstrap administrator accounts after OTP verification

The application verifies the provider token server-side against `/auth/v1/user`; only verified emails from the configured exact school domain are accepted. It stores the provider token in a Secure, HttpOnly, SameSite=Lax cookie. Every reservation and administration mutation validates same-origin requests, current authentication, current block status and current administrator role. No demo role is accepted by the server. Bootstrap administrator emails regain the role at login; remove an email from this configuration when permanently revoking its bootstrap privilege.

OTP sending and real inbox delivery remain untested until a provider is configured. No actual student accounts or administrator have been assigned. Do not describe authentication as live until real-email verification and four-hour session checks pass.

## Reservations

Three courts, one global FIFO queue, four players per court, 30-minute matches. One participation per student across all courts and queue. A free open court starts only with a complete group. Ending a match releases its participants; they must rejoin if they want another match. Closing a court returns its participants to the front and stops its timer. Removing a player returns their former teammates to the front and assembles a fresh full group. Admins can change queue priority, names, block status and administrator roles.

D1 stores one versioned state document. Compare-and-swap updates retry conflicts, so concurrent joins cannot overwrite each other or overfill a court. Clients poll every 3 seconds; countdowns use server clock offset. Expiry and dispatch are calculated server-side on reads and writes. With no connected clients, reconciliation occurs on the next request; no background cron or push transport is implied. Public responses include display names and opaque IDs, never school email addresses; administrators can view student emails.

## Validation

Run `node --experimental-strip-types --test tests/club.test.mjs` for invariants, `npx tsc --noEmit` for type checks and the Sites build helper for production output. Real multi-browser/inbox testing has not been performed. Follow Sites skill for deployment and source persistence.

## Administrator court rosters

Administrators can select exactly four registered, unblocked students for a specified open court. Assigning an empty court starts 30 minutes immediately. Editing an active court preserves its original deadline; replaced participants return to the front of the general queue. Each active court can also reserve one four-person next group. Reserved students leave the general queue, cannot occupy another court or planned group, and start on their assigned court before FIFO dispatch when the current match ends. Closing a court cancels its planned group and returns both groups to the queue. Removing or blocking a reserved participant cancels that group and returns the remaining participants to the queue.

Roster submissions include a snapshot of the current group, next group and start time. The server rejects stale submissions if any of those changed, including after timer expiry. CAS persistence revalidates these conditions on conflicts. Existing state documents with no `nextPlayers` property are normalized in memory; the D1 schema is unchanged. Student court cards show the next group's names, and the student's own panel shows the designated court.
