# User acceptance checklist

Record browser, device, tester, date, result and evidence for every step. Run permission checks against real Supabase accounts, not only the demo role selector.

## Authentication and administration

- [ ] Signed-out user sees login, with no operational records exposed.
- [ ] Owner signs in; a wrong password fails without showing any data.
- [ ] Owner invites a Guide; the email arrives, the link opens the app, password can be set and the Guide can sign in again.
- [ ] Owner creates an Operations account with a 12+ character temporary password.
- [ ] Owner edits a member's name and role; audit records actor and before/after state.
- [ ] Admin cannot create/edit an Owner, including by calling the team endpoint or RPC directly.
- [ ] A user cannot disable themselves or change their own role; the final active Owner cannot be removed.
- [ ] Disable a Guide while they are signed in. Their existing session cannot fetch tours, expenses or receipt URLs. Reactivate and verify access returns.
- [ ] Request password reset; use the email link, set a password and verify old password fails.
- [ ] A client cannot directly update its profile to gain privileges.

## Tours and resources

- [ ] Create a Draft tour; reject reversed dates, zero guests and duplicate code.
- [ ] Assign an active Guide and Company vehicle; try a vehicle with insufficient capacity and verify rejection.
- [ ] Add a Supplier vehicle with supplier name, registration and capacity.
- [ ] Add a Hotel from inside a tour, save it, and verify it is selected in the preserved itinerary form.
- [ ] Assign multiple hotels, attractions and restaurants with date/time, reference, contact, cost, notes and status. Verify resource defaults for location/contact.
- [ ] Reject a stop outside the tour date range. Reject shrinking the tour dates around an existing stop.
- [ ] Edit and remove stops; audit entries appear. Itinerary orders by date/time.
- [ ] Draft → Planned → Ongoing → Completed works. Planning without a guide/vehicle fails. Planned → Draft works. Cancellation works; terminal states cannot reopen.
- [ ] Accounting and Guide cannot mutate tours, vehicles, resources or stops through UI or direct database requests.

## Expenses and receipts

- [ ] Record a general expense and a tour expense in BZD. Reject zero/negative amount.
- [ ] Daily, Monday–Sunday Weekly, Monthly and Yearly totals match dated test records. By Tour matches the selected tour and excludes general expenses when filtering.
- [ ] Estimated itinerary costs do not inflate actual expenses or dashboard totals.
- [ ] Upload JPEG, PNG, WebP and PDF receipts under 10 MB; reject other types and oversize files.
- [ ] Reload and open each receipt. Verify private Storage cannot be accessed anonymously; signed links expire.
- [ ] Guide cannot create an expense for another guide's tour, even with a forged tour UUID.
- [ ] Guide cannot edit another user's expenses; Accounting can edit amounts/categories while creator remains immutable.
- [ ] Disabled accounts cannot upload or read receipts. Unassigned Guides cannot read another tour's receipts.

## Dashboard and mobile

- [ ] Four cards match overall actual expenses, tour actual expenses, ongoing and completed counts.
- [ ] Dashboard tour links open the correct tour. Recent expenses opens reporting.
- [ ] On a 390 px phone, Field Mode shows only assigned tours and today's stops; notes, vehicle and expenses remain accessible.
- [ ] Phone camera/file picker can attach a receipt, save it and view it after refresh.
- [ ] At phone, tablet and desktop widths, navigation works and tables scroll without obscuring actions.
- [ ] Keyboard focus is visible, fields have labels, errors/statuses are announced and every dialog can be closed.
- [ ] Local demo persists changes; real mode does not fall back to demo if sign-in or network fails.
- [ ] Complete the transactional SQL permission test and review backups/restore before going live.

## Onboarding, company and preferences

- [ ] Fresh Owner completes three-step onboarding and creates a company or tour agency. Reload opens the workspace after completion.
- [ ] Fresh Guide/Operations/Accounting reviews company details and finishes without company-edit privileges.
- [ ] Owner/Admin saves all business fields; branding appears on desktop and phone.
- [ ] Upload, replace and remove PNG/JPEG/WebP logos. Reject other formats and files above 2 MB. Test signed logo URLs in staging.
- [ ] Direct API requests deny company writes/logo uploads for non-admins and historical logo reads for non-admins.
- [ ] Check all four languages across Dashboard, Expenses, tours and dialogs, Team Members, Resources, Field Mode and Settings. User content remains unchanged; dates/currency localize.
- [ ] Check light/dark at desktop and 390 px, including tables, dialogs, forms and notices.
- [ ] Save, reload, sign out/in and check another device in staging. Other users retain their own preferences and cannot change yours.
- [ ] Review onboarding preserves company details. Disabled users cannot access company, logos or preferences.
- [ ] Company edits appear in audit. Upgrade existing installation using migration 002 preserves operational data and prompts onboarding.
