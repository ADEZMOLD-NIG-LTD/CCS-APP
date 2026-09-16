# Security specification

The Firestore security rules (`firestore.rules`) are the only authorisation boundary. The web app
hides what a user may not do, but every guarantee below must hold for a client that talks to
Firestore directly. The email API (`server.ts`) authenticates with Firebase ID tokens and re-checks
authorisation with the Admin SDK.

Rules tests: `tests/rules/firestore.rules.test.ts` (`npm run test:rules`).

## Identity and membership

| Concept | Where it lives | Who can change it |
| --- | --- | --- |
| Authenticated user | Firebase Auth | The user. Anonymous tokens are rejected. |
| Platform admin | `platform_admins/{uid}` | Admin SDK / console only |
| Company membership and role | `users/{uid}`: `companyId`, `role`, `status` | See below |
| Invitation | `invites/{companyId}__{email}` | Company Admin/Manager; the invitee may only accept |
| Company approval, plan, modules | `companies/{id}` | Platform admin |

A membership is created in exactly one of these ways:

1. **Owner**: a verified user creates a `PENDING` company with `ownerUid` equal to their uid, and in
   the same batch an `ADMIN` profile for that company.
2. **Invitee**: a verified user whose token email matches a `PENDING` invite creates or updates their
   profile with exactly the invited company, role and warehouse. The same batch marks the invite
   `ACCEPTED` by that uid.
3. **Management**: a company Admin or Manager changes another member's role, status or warehouse.
   Managers cannot touch Admins or grant the Admin role.

A member can use company data only while their profile `status` is `ACTIVE` (not `suspended`) and the
company is approved, `ACTIVE` and not deleted.

## Invariants

1. **Tenant isolation.** Every company document carries `companyId`. Reads and writes require active
   membership of that company, derived from the caller's own profile. Changing `companyId` on update
   is refused.
2. **No self-escalation.** Users cannot change their own role, company or status, approve their own
   company, or write `platform_admins`.
3. **Verified email for grants.** Company ownership and invitation acceptance require
   `email_verified`.
4. **Role matrix.** Create, update and delete rights per collection follow `src/lib/permissions.ts`.
   Auditors are read-only.
5. **Module gating.** Staff, attendance, rosters, payroll, petty cash and store records are readable
   and writable only when the company has the module enabled (or has no module list).
6. **Soft delete only.** Hard deletes of company data are refused. A soft delete changes only the
   deletion fields, requires a reason, and records the caller's uid. Deleted records cannot be edited
   or restored by company users.
7. **Audit log integrity.** Audit entries are append-only, authored by the caller (`userId == uid`)
   and stamped with server time (`createdAt == request.time`).
8. **Paid payroll is immutable.**
9. **Forced password change.** Clearing `mustChangePassword` requires a sign-in newer than the moment
   the change was requested.
10. **Balance counters** (`stock_balances`) are scoped to the member's company, and their document id
    must encode that company.

## Attack cases

| # | Attempt | Expected | Test |
| - | --- | --- | --- |
| 1 | Unauthenticated or anonymous read of company data | Denied | tenant isolation |
| 2 | Signed-in user without a profile reads a company | Denied | tenant isolation |
| 3 | Member reads or writes another company's documents | Denied | tenant isolation |
| 4 | Suspended member, or member of an unapproved company, reads data | Denied | tenant isolation |
| 5 | User sets their own `role: 'ADMIN'` or changes `companyId` | Denied | privilege escalation |
| 6 | User creates a profile joining an arbitrary company | Denied | privilege escalation |
| 7 | Client writes `platform_admins/{uid}` | Denied | privilege escalation |
| 8 | Manager creates or promotes an Admin, or invites one | Denied | privilege escalation / invites |
| 9 | Registrant creates an approved company, or registers unverified | Denied | registration |
| 10 | Invitee accepts with a different role than invited | Denied | invites |
| 11 | Auditor creates or edits records | Denied | role permissions |
| 12 | Staff edits or deletes a purchase | Denied | role permissions |
| 13 | Hard delete, or soft delete without a reason | Denied | role permissions |
| 14 | Forged audit entry (other `userId`, client timestamp), or edit/delete of an entry | Denied | role permissions |
| 15 | Editing a paid payroll | Denied | role permissions |
| 16 | Writing a balance counter for another company | Denied | role permissions |
| 17 | Email API called without a token, with an unverified email, or by a non-manager | 401 / 403 | manual (server) |
| 18 | Email API invoked for an email without a pending invite | 404 | manual (server) |

## Known limitations

These are accepted for a rules-only backend. Revisit them if the threat model changes; most would
move to Cloud Functions.

- **Balance counters prevent races, not fraud.** A member with write access can set a counter to any
  number. The history (transactions, adjustments, bag and petty cash records) is the source of truth.
  The app shows a drift warning when counters and history disagree, and an Admin can rebuild them.
- **Audit logging is performed by the client.** Entries cannot be forged or altered, but a modified
  client could skip writing one. Document history (`updatedAt`, `updatedByUid`, `deletedByUid`) and
  Firestore's Cloud Audit Logs (Data Access logs) provide a second trail when enabled.
- **Partial schema validation.** Rules validate types, ranges, required fields and immutable keys for
  financial documents, but do not reject unknown extra fields or recompute totals such as
  `price × weight`.
- **Module gating is enforced server-side only for** staff, attendance, rosters, payroll, petty cash and
  store records. Other module toggles are enforced in the user interface.
- **Email API rate limits are per instance** and held in memory.
- **Read volume grows with company history.** Ledger balances (supplier, buyer, stock) are derived
  from full history, so a screen that shows a balance reads every transaction, payment and journal
  line for that company. Audit logs are the exception and are paged. Today the largest company holds
  roughly 5,000 documents, which is comfortable; at roughly ten times that, balances should move to
  periodic opening-balance snapshots (a monthly rollup document per company, warehouse and
  commodity), after which screens can read the latest snapshot plus the current period only. That
  needs a scheduled server-side job, so it is deliberately left until Cloud Functions or another
  backend is introduced rather than being half-applied in the client, where it would silently
  produce wrong balances.
- **No billing or subscription enforcement.** Plans and modules are set by a platform admin at
  approval time; nothing collects payment or expires a plan. Adding it needs a payment provider
  decision (for example Paystack or Flutterwave) plus a server endpoint for webhooks, which in turn
  needs the API server deployed.
