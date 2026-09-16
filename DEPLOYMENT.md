# Deployment guide

This guide covers a new environment and the upgrade of an existing one to v1.1 (security and data
integrity release). Follow the sections in order.

---

## 1. Prerequisites

- Node.js 22.12+ and npm
- Firebase CLI: `npm install -g firebase-tools` (or use `npx firebase-tools@15`)
- Java 21 (only for running the security-rules tests locally)
- Access to the Firebase console for the target project, and the Google Cloud console if you deploy
  the email API

Each environment (development, staging, production) should use its **own Firebase project**.

---

## 2. Firebase project configuration

### Authentication

1. **Sign-in providers**: enable **Email/Password** and **Google**.
2. **Disable Anonymous sign-in.** The rules deny anonymous users, and leaving the provider enabled
   only adds attack surface.
3. **Authorized domains**: add the production domain (e.g. `commodityclick.com.ng`) and remove
   domains you no longer use.
4. **Templates**: set the sender name and reply-to for the *Email address verification* and
   *Password reset* templates. Staff onboarding relies on the password reset email.
5. Optional: under **Settings → Password policy**, require at least 10 characters with letters and
   numbers so the server enforces the same policy as the app.

### Firestore

Create the database in production mode. If you use a named database instead of `(default)`, set
`VITE_FIREBASE_FIRESTORE_DATABASE_ID` and `FIREBASE_FIRESTORE_DATABASE_ID` accordingly.

### Web app configuration

Project settings → General → Your apps → Web app. Copy the values into `.env` (local) or the GitHub
environment secrets (CI), using the names in `.env.example`.

> **This project uses a named Firestore database, not `(default)`.** Production data lives in
> `ai-studio-086bebaa-d248-491f-a312-4b87527790a1`. It must be set in
> `VITE_FIREBASE_FIRESTORE_DATABASE_ID` (web app), `FIREBASE_FIRESTORE_DATABASE_ID` (API server and
> scripts) and in the `firestore.database` field of `firebase.json` (CLI deploys). A deploy without
> that field targets a `(default)` database that does not exist.

### App Check and API key restrictions

The Firebase web API key is public by design, but it should not be usable from anywhere:

1. **API key restrictions** — Google Cloud console → APIs & Services → Credentials → the browser
   key → Application restrictions → **Websites**, and list your domains
   (`commodityclick.com.ng`, `www.commodityclick.com.ng`, `<project>.web.app`,
   `<project>.firebaseapp.com`). Under API restrictions, limit it to the APIs the app uses
   (Identity Toolkit, Firestore, Token Service).
2. **App Check** — Firebase console → App Check → register the web app with **reCAPTCHA Enterprise**
   (or reCAPTCHA v3), then enforce it for Firestore and Authentication. Run it in monitoring mode
   first and only enforce once the metrics show legitimate traffic passing, because enforcing
   immediately locks out any client that has not been updated.
   Enforcement requires adding the App Check SDK to the web app, so treat it as a follow-up task.

---

## 3. Deploy security rules and indexes first

```bash
npx firebase-tools@15 deploy --only firestore:rules,firestore:indexes --project <project-id>
```

Then open **Firestore → Rules** in the console and confirm the published rules match
`firestore.rules` in the repository (the header comment starts with *Commodity Control System -
Firestore Security Rules*).

> **Upgrade note.** The v1.1 rules reject writes made by older builds of the app (for example
> unguarded stock writes, profile self-promotion and default-password accounts). Deploy the rules
> and the new web app together, rules first, in a quiet period.

---

## 4. Bootstrap platform administrators

Platform admins can only be granted with the Admin SDK.

1. The person signs up in the app (email/password or Google) and verifies their email address.
2. With credentials for the project (see `.env.example`: `FIREBASE_SERVICE_ACCOUNT` or
   `GOOGLE_APPLICATION_CREDENTIALS`, plus `FIREBASE_PROJECT_ID`):

   ```bash
   npm run admin:grant-super-admin -- person@example.com
   npm run admin:grant-super-admin -- --list
   npm run admin:grant-super-admin -- former-admin@example.com --revoke
   ```

Never commit service-account JSON files. `.gitignore` excludes the common file names.

---

## 5. Migrate existing data (upgrades only)

```bash
npm run admin:migrate                 # dry run: prints the changes and a manual-review list
npm run admin:migrate -- --apply      # writes the changes
```

The script:

- sets `ownerUid` on companies whose owner email belongs to a verified account, and sets a `status`
  (approved companies become `ACTIVE`, others `PENDING`);
- replaces legacy profile roles (`SUPER_ADMIN`, `GUEST`, unknown values) with `STAFF`;
- revokes app access for staff who are dismissed, suspended or deleted;
- creates pending invitations for staff with an email address but no linked login.

Work through the **manual review** list, in particular:

- **ADMIN profiles that are not the company owner.** The old rules let any user promote themselves.
  Confirm each one with the company owner and demote it in *Staff* if it is not legitimate.
- **Accounts still flagged "must change password".** These were created with the old shared
  default password. Send each one a password reset from *Staff → Send password email*, or disable
  the account in Firebase Authentication.
- Profiles keyed by something other than the Firebase uid, and profiles whose company no longer exists.

After migration, review companies in **Platform admin → Companies**: approve legitimate ones (set
plan and modules) and suspend or close the rest.

---

## 6. Build and deploy the web app

```bash
npm ci
npm run typecheck && npm test
npx vite build                         # fails if the Firebase web config is missing
npx firebase-tools@15 deploy --only hosting --project <project-id>
```

`firebase.json` sets security headers, long-lived caching for hashed assets, and `no-cache` for
`index.html`. Source maps are not built.

### Custom domain

Hosting → Add custom domain → follow the DNS instructions (A and TXT records at your registrar).
SSL is provisioned automatically. Add the domain to Authentication → Authorized domains.

---

## 7. Email API (optional, recommended)

Without the API, onboarding still works: new staff receive the Firebase password-setup email. The
API adds a branded invitation email and the SMTP test in the platform admin panel.

### Cloud Run

1. Create a secret for the SMTP password (Secret Manager), e.g. `ccs-smtp-pass`.
2. Grant the Cloud Run runtime service account:
   - **Firebase Authentication Viewer** (`roles/firebaseauth.viewer`), used to check revoked sessions
   - **Cloud Datastore User** (`roles/datastore.user`), used to read profiles, companies and invites
3. Deploy from the repository root:

   ```bash
   gcloud run deploy ccs-api --source . --region <region> --allow-unauthenticated \
     --set-build-env-vars GOOGLE_NODE_RUN_SCRIPTS=build:server \
     --set-env-vars NODE_ENV=production,APP_URL=https://<your-domain>,FIREBASE_PROJECT_ID=<project-id>,SMTP_HOST=smtp.gmail.com,SMTP_PORT=587,SMTP_USER=<sender> \
     --set-secrets SMTP_PASS=ccs-smtp-pass:latest
   ```

   "Allow unauthenticated" only exposes the HTTP endpoint; every email endpoint verifies a Firebase
   ID token and re-checks permissions in Firestore.

4. Route `/api/**` from Hosting to the service by adding this rewrite **before** the SPA rewrite in
   `firebase.json`, then redeploy hosting:

   ```json
   { "source": "/api/**", "run": { "serviceId": "ccs-api", "region": "<region>" } }
   ```

The server rate-limits per instance in memory. If you scale beyond one instance, put Cloud Armor or
API Gateway rate limiting in front of it.

### Self-hosting

`npm run build && npm start` serves the web app and the API on `PORT` (default 3000). Terminate TLS
in a reverse proxy and set `TRUST_PROXY` to the number of proxies in front of the app.

---

## 8. CI/CD (GitHub Actions)

`.github/workflows/ci-cd.yml`:

- **Every push and pull request**: typecheck, unit tests, security-rules tests (emulator), and a
  compile-check build.
- **Pushes**: build with the environment's Firebase config, deploy Firestore rules and indexes (see
  below), then deploy Hosting. `main`/`master` deploy to the live channel; other branches deploy to a
  preview channel named after the branch.

Branch → GitHub environment: `main`/`master` → `production`, `staging` → `staging`, others →
`development`. On each environment add these secrets:

`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`,
`VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
`VITE_FIREBASE_MEASUREMENT_ID`, `VITE_FIREBASE_FIRESTORE_DATABASE_ID`, `FIREBASE_SERVICE_ACCOUNT`

Optional environment variables: `VITE_SUPPORT_EMAIL`, and `FIRESTORE_DEPLOY=true` for non-production
environments that have their own Firebase project. Rules deploy automatically only for production
unless that variable is set, so a preview branch can never replace production rules.

The deploy service account (the `FIREBASE_SERVICE_ACCOUNT` secret) needs:

| Role | Used for |
| --- | --- |
| Firebase Hosting Admin | deploying the web app |
| Firebase Rules Admin | publishing `firestore.rules` |
| Cloud Datastore Index Admin | applying `firestore.indexes.json` |
| **Service Usage Consumer** | the CLI checks that the Firestore API is enabled before deploying |

Without **Service Usage Consumer** the rules step fails with
`Permission denied to get service [firestore.googleapis.com]` and the hosting step never runs.
A deploy from a developer machine does not hit this, because `firebase login` uses your own
account rather than the service account.

---

## 9. Post-deployment checklist

- [ ] Published Firestore rules match the repository
- [ ] Anonymous sign-in is disabled
- [ ] The SMTP password was rotated (the old email API returned SMTP errors and account details to
      callers) and is stored only in Secret Manager / server environment
- [ ] Accounts created with the old default password have been reset or disabled
- [ ] At least two platform admins exist; former admins are revoked
- [ ] Migration applied and the manual-review list worked through
- [ ] Sign up → verify email → register a company → approve it as platform admin → invite a staff
      member → staff sets a password and accepts the invite
- [ ] A dismissed staff member loses access immediately
- [ ] A purchase, sale, transfer and petty cash expense update balances; overdrawing is refused
- [ ] Reports and PDF exports open for Admin, Account and Auditor
- [ ] Demo mode shows the demo banner and never touches production data

---

## 10. Behaviour changes in v1.1

Share these with company admins before the upgrade:

- **New companies need platform approval** before anyone can use them. Plans and modules are set at
  approval.
- **Staff join by invitation.** No default passwords are issued; staff set their own through the
  password email. Dismissing or suspending staff revokes their access.
- **Direct deliveries credit the supplier** with the supplier price (or the sale value when no supplier
  price was recorded), so supplier balances that include past direct deliveries can change.
- **The cash book includes supplier payments and customer receipts.** Supplier/customer charges,
  expense deductions and petty cash retirements no longer count as cash movements.
- **Moisture deductions** apply only when measured moisture is above the benchmark (previously a
  reading below the benchmark increased the net weight).
- **Stock, bags and petty cash cannot go negative.** Sales, transfers, returns, issues and expenses that
  exceed the available balance are refused.
- **Profit** in Analytics is now an estimate based on the cost of goods sold, excluding capital, loans,
  advances, drawings and asset purchases.
- **PAYE** uses the Nigeria Tax Act 2025 bands and rent relief for payroll months from January 2026.
- **Paid payroll is locked**, and paying payroll posts a staff salary entry to the cash book.

---

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| "Missing or insufficient permissions" for everyone | Rules not deployed, company not approved, or user profile not linked to the company |
| A user sees "Verify your email" | The user has not clicked the verification link; they can resend it from that screen |
| Build fails with "no Firebase configuration" | `VITE_FIREBASE_*` variables missing in the build environment |
| Query error mentioning an index | `firestore.indexes.json` not deployed yet (indexes can take minutes to build) |
| Test email says the API is not deployed | `/api/**` is not routed to the API server (section 7) |
| Balance drift banner in Inventory | Counters differ from history (e.g. data edited in the console); an Admin can rebuild them from that banner |
