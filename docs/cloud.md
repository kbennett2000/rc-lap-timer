# Accounts and cloud sync

The phone app can have accounts and cloud sync. They're built in and tested, but they're **off** unless someone runs
a cloud service for them and builds the app with it. The public app at https://kbennett2000.github.io/rc-lap-timer/
doesn't have one at the moment, because a cloud service costs money and the project has no budget.

This guide is for whoever decides to run one: for this repository's app, or for a fork's. It takes no code changes,
only a [Supabase](https://supabase.com) project, an email provider, and a few settings. Turning it on takes about
half an hour.

## What people get
- **An account, without a password.** In **Manager → Data → Account and cloud sync**, you enter your email address
  and type in the code that arrives. The same steps create the account the first time.
- **Sync now.** This copies the phone's drivers, cars, locations, sessions and motion settings into the account, then
  brings back anything the account has that the phone doesn't.
  - It merges with the same rules as restoring a backup or syncing with a timer: deletes carry over, and records with
    the same name become one.
  - Every phone signed in to the account ends up with the same data.
  - A sync counts as a backup.
- **Delete account**, in the same card. It deletes everything the account holds in the cloud.

What doesn't change:
- The data still lives on the phone, and the app works offline.
- Signing out or deleting the account leaves the phone's data as it is.
- If the cloud service is down, only the account card notices.

## What it costs
- **Supabase:** check its [pricing](https://supabase.com/pricing).
  - **Free plan:** enough for a club. But a free project is paused after a week with no activity, and then sign-in and
    sync stop working until you restore it in the dashboard. The rest of the app keeps working.
  - **Paid plans** (about $25 a month at the time of writing) aren't paused.
- **Email:** Supabase's built-in email only sends to the project's own team, so other people need an email (SMTP)
  provider. Many providers have a free tier that covers sign-in codes.
- **GitHub Pages**, which hosts the app, stays free.

## Turning it on
1. **Create a Supabase project** at https://supabase.com (New project). From its settings, note:
   - the **Project URL**, like `https://abcdefgh.supabase.co`;
   - the **publishable key** (Project Settings → API Keys). An older project's `anon` key works too.

   Never use the **secret** or `service_role` key in the app.
2. **Create the database** from this repository's [supabase/migrations](../supabase/migrations) folder, in either of
   two ways:
   - **With the Supabase CLI,** from a checkout of the repository:
     ```bash
     npx supabase@2.119.0 login
     npx supabase@2.119.0 link --project-ref <your project's reference, the abcdefgh in its URL>
     npx supabase@2.119.0 db push
     ```
   - **In the dashboard's SQL Editor:** paste each file in `supabase/migrations`, oldest (by file name) first, and
     run it.
3. **Set up sign-in.** These are all in the dashboard, under **Authentication**:
   - **Sign In / Providers → Email:** enabled, with **Confirm email** on (the default).
   - **Emails → Templates:** set both **Confirm signup** and **Magic Link** to the subject "Your RC Lap Timer code".
     For the bodies, use [confirmation.html](../supabase/templates/confirmation.html) and
     [magic_link.html](../supabase/templates/magic_link.html). The default templates send a link instead of the
     code, and an iPhone would open that link in Safari rather than in the installed app.
   - **Emails → SMTP Settings:** your email provider's server, user and password, and the address the codes come
     from.
   - **URL Configuration → Site URL:** the app's address, like `https://<owner>.github.io/rc-lap-timer/`.
   - **Rate Limits:** the defaults suit a club. Raise "emails sent per hour" if many people sign in at once.
   - The app takes codes of any length that Supabase sends (6 digits by default).
4. **Tell the app about the project.** In the GitHub repository, go to Settings → Secrets and variables → Actions →
   **Variables** → New repository variable, and add:
   - `CLOUD_URL`: the Project URL;
   - `CLOUD_KEY`: the publishable key;
   - optionally `CLOUD_PRIVACY_URL`: your privacy notice (an `https://` address). The account card links to it.

   These are *variables*, not secrets. The publishable key is meant to be public: the database's row level security
   decides what each person can read and change.
5. **Publish the app with it.** Go to Actions → **Publish the phone app** → Run workflow. Merging to `main` also
   publishes it.
6. **Check it.** Open the app and go to Manager → Data → Account and cloud sync. Sign in, sync, sign in on a second
   phone or browser, and sync there: the first phone's sessions should appear.

A fork works the same way: do these steps in the fork, with its GitHub Pages turned on (Settings → Pages → Source:
"GitHub Actions").

## Running it
- **Who sees what.** Each account's data can be read and changed only by that account. The rules are in the
  migrations, and [supabase/tests](../supabase/tests) checks them.
- **Accounts and data.** Authentication → Users lists the accounts; deleting one deletes its data.
  - **Table Editor → `cloud_bundles`** has one row per account that has synced. Its `bundle` is in the same format
    as a backup file.
  - People can delete their own account from the app.
- **Privacy.** You'll be keeping people's email addresses and their lap data. Publish a privacy notice and set
  `CLOUD_PRIVACY_URL`.
- **Updating the app.** When a new version adds a file to `supabase/migrations`, apply it before publishing that
  version: run `db push` again, or paste the new file into the SQL Editor.
- **Backups.** Paid Supabase plans back up the database daily. Every phone also keeps its own copy of its data.

## Turning it off
1. Delete the `CLOUD_URL` and `CLOUD_KEY` variables.
2. Run **Publish the phone app** again. The account card disappears, and the data on people's phones stays.
3. If you like, delete the Supabase project, which deletes everyone's cloud copy.

## How it works (for developers)
- [next.config.js](../next.config.js) passes the `NEXT_PUBLIC_CLOUD_*` settings to the phone build only. Without
  them, the cloud code isn't in the build at all. The Pi build, whose timer has no internet, never has it.
  [scripts/check-bundles.mjs](../scripts/check-bundles.mjs) checks both ways.
- [src/cloud](../src/cloud):
  - `client.ts` loads the Supabase library the first time it's needed;
  - `account.ts` handles signing in with a code;
  - `sync.ts` merges with the same code a timer uses ([src/domain/sync](../src/domain/sync)), and saves through
    `put_bundle`, which refuses a save if another device saved since this one read. The phone then reads again and
    merges, up to three times.
- **The UI** is [src/features/cloud](../src/features/cloud).
- **Tests:**
  - [supabase/tests](../supabase/tests) tests who can do what, in the database itself;
  - [tests/e2e/cloud.spec.ts](../tests/e2e/cloud.spec.ts) tests sign-in and sync in the browser;
  - [src/cloud](../src/cloud)'s unit tests cover the merging and the error messages.

  CI runs them all against a local Supabase. The README's Checks section has the local steps.
