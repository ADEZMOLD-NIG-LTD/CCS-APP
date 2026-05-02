# Firestore Security Specification

## Data Invariants
1. **Multi-tenancy isolation**: Every document must belong to a `companyId`. Users can only read/write documents that match their profile's `companyId`.
2. **Soft Delete Integrity**: Once a record is marked `isDeleted: true`, it cannot be reverted or modified by non-admin users.
3. **Deletion Accountability**: Soft deletes MUST include `deletionReason`, `deletedBy`, and `deletedAt`.
4. **Immutable Roots**: `companyId` and `id` must never change after creation.
5. **Admin Supremacy**: Only users with the `ADMIN` role (or Super Admins) can trigger soft deletes.

## The "Dirty Dozen" Payloads (Attacks)

### 1. The Shadow Field Attack (Integrity)
**Payload**: `{"id": "tx1", "companyId": "comp1", ..., "isVerifiedBySystem": true}`
**Target**: `transactions/tx1`
**Intent**: Inject a field not defined in the schema to bypass system logic.
**Expected**: `PERMISSION_DENIED` (Strict schema validation).

### 2. The Identity Spoofing Attack (Identity)
**Payload**: `{"id": "tx1", "companyId": "target_company_id", ...}`
**Target**: `transactions/tx1` (Create)
**Intent**: Create a record in another company's collection.
**Expected**: `PERMISSION_DENIED` (Company ID must match user profile).

### 3. The PII Scraping Attack (Privacy)
**Action**: `get(users/another_user_id)`
**Intent**: Read another user's email/phone.
**Expected**: `PERMISSION_DENIED` (Users can only read their own profile or if they are Admin of same company).

### 4. The Immortal Reversion Attack (State)
**Payload**: `{"isDeleted": false}` (Update on a deleted record)
**Target**: `transactions/tx1` (Existing: `isDeleted: true`)
**Intent**: Re-activate a deleted transaction without admin approval.
**Expected**: `PERMISSION_DENIED` (State locking).

### 5. The Anonymous Deletion Attack (Accountability)
**Payload**: `{"isDeleted": true}` (Missing `deletionReason`)
**Target**: `transactions/tx1`
**Intent**: Delete a record without providing a reason.
**Expected**: `PERMISSION_DENIED` (Reason is required for deletion action).

### 6. The Denial of Wallet ID Attack (Resource Poisoning)
**Target ID**: `a_very_long_string_exceeding_128_chars_...`
**Intent**: Exhaust database resources/memory with oversized IDs.
**Expected**: `PERMISSION_DENIED` (`isValidId` check).

### 7. The Cross-Company Write Attack (Multi-tenancy)
**Target**: `suppliers/s1` (Existing: `companyId: 'comp1'`)
**User Profile**: `companyId: 'comp2'`
**Intent**: Modify a supplier belonging to another company.
**Expected**: `PERMISSION_DENIED`.

### 8. The System Field Hijack (Escalation)
**Payload**: `{"role": "ADMIN"}`
**Target**: `users/self` (Update)
**Intent**: Escalate own role from `STAFF` to `ADMIN`.
**Expected**: `PERMISSION_DENIED` (Role can only be changed by existing ADMIN or SuperAdmin).

### 9. The Orphaned Write Attack (Relational)
**Payload**: `{"companyId": "non_existent_company", ...}`
**Target**: `transactions/tx1` (Create)
**Intent**: Create a transaction for a company that doesn't exist.
**Expected**: `PERMISSION_DENIED` (`exists()` check on company).

### 10. The Temporal Spoofing Attack (Time)
**Payload**: `{"createdAt": "2020-01-01T00:00:00Z"}`
**Target**: `transactions/tx1` (Create)
**Intent**: Backdate a transaction creation.
**Expected**: `PERMISSION_DENIED` (Should ideally use `request.time` or strict validation).

### 11. The Partial Update Bypass (Keys)
**Payload**: `{"totalValue": 0}` (Update)
**Target**: `transactions/tx1`
**Intent**: Zero out a transaction value without passing full validation.
**Expected**: `PERMISSION_DENIED` (Update must specify allowed fields and maintain integrity).

### 12. The Unauthorized List Query (Scraping)
**Action**: `list(transactions)` (No `where` clause)
**Intent**: Attempt to fetch all transactions across all companies.
**Expected**: `PERMISSION_DENIED` (Rule must enforce company filtering).
