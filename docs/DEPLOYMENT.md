# GitHub and Vercel deployment

1. Run the checks in README and complete UAT against a separate Supabase staging project.
2. Create a private GitHub repository. Commit this project root, including `package-lock.json`, migrations and docs, excluding `.env.local`, `.next` and `node_modules`. The supplied GitHub Actions workflow runs type checking, unit tests and a production build on pushes and PRs.
3. Import the repository in Vercel. Framework: Next.js. Root directory: the directory containing `package.json` (repository root if you push this folder). Build command: `npm run build`. Use Node.js 24.
4. Set all five variables from `.env.example` for the intended Vercel environment. Set `NEXT_PUBLIC_DEMO_MODE=false` in production. Set `NEXT_PUBLIC_APP_URL` to the exact production HTTPS URL. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Use a separate Supabase project for previews/staging.
5. Apply both migrations in filename order to production Supabase before opening the application. Bootstrap a real Owner as documented. Configure Supabase Auth Site URL, redirect allowlist, invitation/recovery email templates and SMTP. Turn off public signup.
6. Deploy. Verify sign-in, invitation acceptance, password recovery, roles, disable/reactivate, expense receipt upload/view, onboarding, company logos, saved language/appearance and every lifecycle transition. In a signed-out browser, database rows and receipts must be inaccessible.
7. Configure your custom domain, then update the app URL and Supabase redirect allowlist and rebuild. Public variables are bundled at build time.

## Operations

- Keep Vercel and Supabase credentials out of GitHub and browser code. Rotate a leaked service key immediately.
- Enable database backups appropriate to the account plan. Export private Storage receipts and company logos as well: database backups alone do not contain file bytes. Rehearse restoring both to staging.
- Inspect Vercel server errors, Supabase database/Auth logs and the application's audit trail. Audit entries include before/after operational records; restrict administrator access accordingly.
- Review dependencies and lockfile updates, run CI and UAT before promoting releases. Supabase migrations are append-only after deployment. Test new migrations against staging first.
- For rollback, deploy a previously verified Git commit; use a reviewed compensating migration for schema changes. Do not drop production tables to retry the initial migration.
- Set invite-based access and a strong password policy; enable MFA through Supabase if needed. This initial UI implements password authentication and recovery, not a custom MFA enrollment screen.

This delivery includes ready-to-deploy files. No GitHub repository, Supabase project, outgoing email or Vercel deployment is created without account configuration.
