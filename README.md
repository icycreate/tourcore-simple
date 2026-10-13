# TourCore Simple

A Next.js App Router application for a single tour operator. Includes Dashboard, Expenses, Tour Management, Team Members, Field Mode, a small reusable resource directory, Company/Supplier vehicles, first-time onboarding and Settings / Company Profile. Supports English, Spanish, Traditional Chinese and Simplified Chinese, with light/dark appearance saved per user. Currency is BZD; reporting uses the Belize calendar and Monday-start weeks. Estimated assignment costs are separate from actual recorded expenses.

## Quick start: local demo

Requires Node.js 24 and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

On Windows PowerShell use `Copy-Item .env.example .env.local`. Open http://localhost:3000. Leave Supabase variables blank and keep `NEXT_PUBLIC_DEMO_MODE=true`. Demo changes and uploaded receipts persist in this browser's local storage. Use the header selector to try Owner, Operations, Accounting and Guide. Demo accounts are illustrative, not real logins. Demo uploads consume browser storage; use small files. Clear the `tourcore-demo` local storage entry to reset.

## Connect Supabase

1. Create a Supabase project. Run `supabase/migrations/202610120001_tourcore.sql` followed by `supabase/migrations/202610120002_company_settings.sql` once in its SQL editor, or apply it with Supabase CLI migrations. The migration creates the tables, constraints, role permissions, audit triggers and private receipts and company-logo buckets. Existing installations apply only the new company-settings migration; do not rerun the initial migration.
2. Optionally run `supabase/seed.sql`. It creates resources, two vehicles and a draft tour. It creates no authentication accounts.
3. In Auth settings disable public signups, enable email/password, configure your SMTP provider, set Site URL and add the local and production app URLs to Redirect URLs. Set the password minimum to 12 characters. Invitations and password recovery use Supabase email links; the application lets users set their password after recovery/invitation.
4. Create the first user through Supabase Auth, then run the following trusted bootstrap operation in the SQL editor, replacing the email:

```sql
update public.profiles set role = 'Owner'
where email = 'your-owner-email@example.com';
```

5. Set `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_OR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SERVICE_ROLE_OR_SECRET_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_MODE=false
```

6. Restart Next.js and sign in. Complete onboarding and create your company or agency, then invite the team from Team Members. The privileged server key is used only by `/api/team` for Auth account creation; every request validates the caller's session and active administrator profile. Team profile changes run through an authorization-checked database function.

Never commit `.env.local` or put a privileged key in a `NEXT_PUBLIC_` variable. There is no credential baked into the project. Configuration alone does not provision Supabase or deploy Vercel.

## Company and personal settings

First-time users choose language and appearance, review company information and complete setup. Owner/Admin creates and edits the company; other roles view it. This remains one company per installation. Settings includes business details and PNG, JPEG or WebP logo uploads (up to 2 MB), replacement and removal. Company changes are audited, and branding appears in the sidebar/header.

Every user can preview language/appearance immediately and click Save preferences to persist them. Supabase preferences follow the account across devices; demo preferences persist only in this browser, separately for each demo user. Review onboarding revisits setup. Labels, statuses, roles and date/currency display are localized throughout the app. User-entered content remains as entered.

## Working flows

- Create a Draft tour; assign an active Guide and vehicle with sufficient capacity; move to Planned, then Ongoing, then Completed. Cancel Draft, Planned or Ongoing tours. Completed and Cancelled are terminal states.
- Create resources in Tour Resources, or use **+ Add new resource** from the tour assignment dialog. Saving returns to the itinerary form with the new resource selected and the draft details preserved. Each stop includes a resource, date/time, location, contact, reference, estimated cost, notes and confirmation status. Add multiple stops to assign multiple hotels, attractions or restaurants.
- Guides open Field Mode, choose an assigned tour, review today's itinerary and enter actual expenses with optional receipt uploads. Field Mode requires a connection in Supabase mode; it is not an offline sync system.
- Expenses offers Daily, Weekly, Monthly, Yearly and By Tour views. General operating expenses have no tour. Guides must attach their expenses to an assigned tour.
- Owners/Admins add a user with a temporary password or email invitation, edit name/role, disable/reactivate and request password reset emails. Email addresses are immutable in this UI; invite a new account to change email. Everyone can change their own password.
- Disabling a profile immediately blocks app/database/storage access, including an already issued session. Auth sessions themselves are not revoked; reactivation restores access. Disable then request a password reset if credentials are compromised.
- Audit logs are database-generated and immutable to application users. Owner/Admin can review them in Team Members. Auth email delivery and password changes live in Supabase Auth logs, not the operational audit trail.

## Permissions

| Capability                               | Owner/Admin | Operations | Accounting | Guide               |
| ---------------------------------------- | ----------- | ---------- | ---------- | ------------------- |
| Read tours and actual expenses           | All         | All        | All        | Assigned tours      |
| Manage tours, stops, resources, vehicles | Yes         | Yes        | No         | No                  |
| Add expenses                             | Yes         | Yes        | Yes        | Assigned tours only |
| Edit expenses                            | All         | Own        | All        | Own, assigned tours |
| Manage users / audit log                 | Yes         | No         | No         | No                  |
| Assign or modify an Owner                | Owner only  | No         | No         | No                  |

Database RLS is authoritative; browser controls are for usability. Profiles cannot be directly modified by application clients. The guarded team function prevents self-lockout and removing the final active Owner. Tours, resources, vehicles and expenses are retained rather than deleted; itinerary stops may be removed and audited. Receipts are private, with short-lived signed URLs. They are stored under the expense creator's UUID and validated against Storage objects.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

`tests/rules.test.mjs` exercises role boundaries, lifecycle and calendar reporting. `tests/database.test.mjs` applies the actual migration and seed to a local PostgreSQL engine (PGlite), emulating Supabase's supplied Auth/Storage schemas, and tests RLS, receipts, company logos, user preference privacy, disabled accounts and audit protections. Translation tests check catalog completeness, interface labels and localized formatting. `supabase/tests/authorization.sql` is a transactional permission smoke test to run in a configured Supabase staging project. Follow `docs/UAT.md` before production use. See `docs/DEPLOYMENT.md` for GitHub and Vercel.

## Scope and operational limits

This is a single-operator application, not a multi-tenant service. There is no CRM, public/customer catalogue, booking center, quotation, invoice, purchase order, supplier master or installer. Supplier is a vehicle source with a supplier name only. The directory has only basic hotel/attraction/restaurant information.

The initial implementation fetches permitted tables on load and after mutations. For large datasets, add server pagination and date-filtered queries. Live editing does not merge concurrent changes; last successful write wins. Receipt uploads happen before expense saves, so a failed save may leave an unlinked private file; an administrator can clean these in Storage. Changing another user's expense supports retaining their existing receipt; adding a replacement receipt must be done by its creator. Back up Postgres and Storage together.

Replaced logos and failed uploads may leave historical private files for administrator cleanup. Non-administrators can read only the current company logo.
