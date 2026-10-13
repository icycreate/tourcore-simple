# Delivery verification — October 12, 2026

## Passed

- Next.js production build, including TypeScript compilation.
- Standalone type check with Next.js route type generation, suitable for a fresh CI checkout.
- 20 automated test assertions/subtests: reporting calendars, role boundaries, lifecycle, and migration/RLS tests in PGlite (PostgreSQL).
- Both actual migrations and seed execute successfully in the PostgreSQL test engine, with Supabase Auth/Storage schemas emulated by the test fixture.
- RLS denies anonymous reads, guide self-promotion, unassigned tour access, cross-tour expense insertion, unauthorized receipt access and audit deletion.
- Disabled accounts lose tour, expense and receipt access despite retaining their session UUID.
- Tour guide/vehicle requirements, vehicle capacity, stop date bounds, and terminal lifecycle states are enforced.
- Browser demo: create and save tour, assign Guide and vehicle, move Draft to Planned.
- Browser demo: add a new Hotel from a tour; return to the itinerary form with selected resource and preserved title; save assignment.
- Browser demo: Guide mode, Field Mode itinerary, and 390 px phone viewport without horizontal page overflow.
- Browser demo: add a BZD 12.50 expense with a PNG receipt; tour total updates; reload preserves records; embedded receipt image loads.
- Dashboard screenshot saved alongside the source delivery.

The browser test initially blocked a temporary receipt URL. Receipt viewing was changed to an embedded preview and verified successfully.

## Company-settings update

- Production build and type check pass.
- Tests verify four translation catalogs, interface label coverage, interpolation and localized formatting.
- Database tests verify singleton company rules, administrator-only edits, private logo paths, preference privacy and disabled-user denial.
- Browser demo verified company creation, onboarding completion, company branding, PNG logo upload/removal, preference persistence after reload, both Chinese variants, light desktop and dark 390 px phone layouts.

## Still requires a configured staging project

No Supabase credentials, GitHub repository or Vercel project were supplied. The application therefore runs in local demo mode. Live invitation emails, password-recovery emails, real Supabase signed Storage URLs, deployed Auth behavior and Vercel deployment were not exercised. Complete `UAT.md` and the transactional Supabase authorization smoke test against staging before production use.

PGlite verifies actual application SQL and PostgreSQL authorization semantics; it does not replace tests of hosted Supabase's Auth service, Storage API, SMTP or deployment settings.
