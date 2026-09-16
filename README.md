# Commodity Control System (CCS)

Commodity Control System by Adezmold Business Consulting: purchasing, sales, stock, cash and staff
management for cocoa, cashew and palm kernel traders, with multiple companies on one platform.

## Features

- **Trade**: purchases with moisture/tare/mold deductions, sales (including direct delivery from a
  supplier to a buyer), purchase and sales returns, stock transfers between warehouses.
- **Stock**: per-warehouse commodity, bag and petty-cash balances with overdraw protection.
- **Accounts**: supplier and customer ledgers, supplier payments, a cash book (cash / bank) and
  estimated profit.
- **Store keeper register**: an independent warehouse record for dual control.
- **Staff**: invitations, roles, attendance, rosters and payroll (PAYE under PITA 2011 until
  Dec 2025 and the Nigeria Tax Act 2025 from Jan 2026, pension, rent relief).
- **Reports**: balances, operations, cash book, packaging, transfers, attendance, payroll, audit
  trail; PDF export.
- **Platform administration**: company approval, plans and modules, suspension, broadcasts.
- **Demo mode**: a training sandbox stored only in the browser.

## Architecture

| Part | Technology | Notes |
| --- | --- | --- |
| Web app | React 19, Vite 6, Tailwind 4 | Static SPA on Firebase Hosting |
| Data and auth | Firestore, Firebase Authentication | No Cloud Functions |
| Security | `firestore.rules` | The only authorisation boundary; see [security_spec.md](security_spec.md) |
| Email API (optional) | Express + Firebase Admin (`server.ts`) | Invitation emails and SMTP test; e.g. Cloud Run |

Key source folders:

| Path | Contents |
| --- | --- |
| `src/lib/permissions.ts` | Role → permission matrix (mirrored in `firestore.rules`) |
| `src/lib/finance.ts` | All balance, stock, cash book, payroll and profit calculations (unit tested) |
| `src/lib/writes.ts` | Atomic writes, balance guards, preconditions, offline refusal |
| `src/lib/audit.ts` | Audit log entries written in the same commit as the change |
| `src/contexts/AuthContext.tsx` | Sign-in, access state machine, company membership |
| `src/contexts/CompanyDataContext.tsx` | One shared Firestore subscription per collection |
| `src/components/` | Feature modules |
| `tests/rules/` | Security rules tests (Firestore emulator) |
| `scripts/` | Admin scripts (super admin grant, legacy data migration) |

### Conventions for contributors

- Check permissions with `can('<action>')` from `useAuth()`; add new actions to
  `src/lib/permissions.ts` **and** `firestore.rules`, with a rules test.
- Never compute balances inline. Use the functions in `src/lib/finance.ts`.
- Write through `useCommit().commit(ops, { guard, preconditions })` and include an `auditOp(...)`.
  Stock-affecting changes pass a balance guard built with `useBalanceGuard` and `diffEffects`.
- Deletions are soft (`isDeleted`, `deletionReason`, `deletedBy`, `deletedByUid`, `deletedAt`).
- Dates picked in forms are local calendar days: use `localDateToIso` / `isoToLocalDate`.
- Import Firestore functions from `src/lib/fs.ts` (it switches to the demo database at runtime).

## Getting started

Prerequisites: Node.js 22.12 or newer. Java 21 is needed only to run the security-rules tests.

```bash
npm install
cp .env.example .env        # fill in the VITE_FIREBASE_* values of a development project
npm run dev                 # web app + email API on http://localhost:3000
```

Without Firebase configuration the app offers the demo only. `npm run dev:client` runs Vite alone.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run dev:client` | Development server (with / without the email API) |
| `npm run build` | Production web build (`dist/`) and API bundle (`dist-server/`) |
| `npm start` | Run the built API server (serves `dist/` too when present) |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (finance, dates, CSV, utilities) |
| `npm run test:rules` | Firestore rules tests in the emulator (needs Java) |
| `npm run admin:grant-super-admin -- <email>` | Grant platform admin (`--revoke`, `--list`) |
| `npm run admin:migrate` | Report legacy data problems; add `--apply` to fix |

The production build fails if the Firebase configuration is missing. Set `VITE_ALLOW_MOCK_BUILD=true`
only for a deliberate demo-only bundle.

## Roles

| Capability | Admin | Manager | Account | Auditor | Store keeper | Staff |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| View suppliers, buyers, trades, stock | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Record purchases and sales, manage parties | ✓ | ✓ | ✓ | | | ✓ |
| Edit trades | ✓ | ✓ | ✓ | | | |
| Delete trades, adjust ledger entries | ✓ | | | | | |
| Transfers and inventory adjustments | ✓ | ✓ | | | | |
| Supplier payments, general journal, fund petty cash | ✓ | ✓ | ✓ | | | |
| Petty cash expenses, bag movements | ✓ | ✓ | ✓ | | ✓ | ✓ |
| Store keeper register | ✓ | ✓ | | read | ✓ | |
| Warehouses (delete: Admin only) | ✓ | ✓ | | | | |
| Staff, invitations | ✓ | ✓ | read | read | | |
| Attendance and payroll | ✓ | ✓ | ✓ | read | | |
| Reports and analytics | ✓ | ✓ | ✓ | ✓ | | |
| Audit logs | ✓ | ✓ | | ✓ | | |
| Company settings | ✓ | | | | | |

Managers cannot create, promote or modify Admins. Platform (super) admins are separate from company
roles: they approve companies, set plans and modules, and can suspend companies and users.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md).

## License

Private and proprietary.
