import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-ccs-rules';
let env: RulesTestEnvironment;

const now = new Date().toISOString();

async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), path), data);
  });
}

function as(uid: string, email: string, extra: Record<string, unknown> = {}): Firestore {
  return env
    .authenticatedContext(uid, { email, email_verified: true, firebase: { sign_in_provider: 'password' }, ...extra })
    .firestore() as unknown as Firestore;
}

async function seedCompany(id: string, overrides: Record<string, unknown> = {}) {
  await seed(`companies/${id}`, {
    id,
    name: `Company ${id}`,
    ownerUid: `${id}-owner`,
    ownerEmail: `owner@${id}.com`,
    isApproved: true,
    status: 'ACTIVE',
    createdAt: now,
    ...overrides,
  });
}

async function seedMember(uid: string, companyId: string, role: string, overrides: Record<string, unknown> = {}) {
  await seed(`users/${uid}`, {
    uid,
    email: `${uid}@${companyId}.com`,
    displayName: uid,
    role,
    companyId,
    status: 'ACTIVE',
    createdAt: now,
    ...overrides,
  });
}

function member(uid: string, companyId: string) {
  return as(uid, `${uid}@${companyId}.com`);
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seedCompany('acme');
  await seedCompany('rival');
  await seedMember('acme-admin', 'acme', 'ADMIN');
  await seedMember('acme-manager', 'acme', 'MANAGER');
  await seedMember('acme-staff', 'acme', 'STAFF');
  await seedMember('acme-auditor', 'acme', 'AUDITOR');
  await seedMember('rival-admin', 'rival', 'ADMIN');
  await seed('suppliers/s1', { id: 's1', companyId: 'acme', name: 'Farm One', previousBalance: 0 });
  await seed('staff/st1', { id: 'st1', companyId: 'acme', name: 'Clerk', role: 'STAFF', status: 'ACTIVE', salary: 100000, email: 'new.person@mail.com' });
});

describe('tenant isolation', () => {
  it('denies unauthenticated and anonymous access', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'suppliers/s1')));
    const anonymous = env.authenticatedContext('anon', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    await assertFails(getDoc(doc(anonymous, 'suppliers/s1')));
  });

  it('denies signed-in users without a profile', async () => {
    const stranger = as('stranger', 'stranger@mail.com');
    await assertFails(getDoc(doc(stranger, 'suppliers/s1')));
    await assertFails(getDocs(query(collection(stranger, 'suppliers'), where('companyId', '==', 'acme'))));
  });

  it('allows members to read their own company only', async () => {
    const staff = member('acme-staff', 'acme');
    await assertSucceeds(getDoc(doc(staff, 'suppliers/s1')));
    await assertSucceeds(getDocs(query(collection(staff, 'suppliers'), where('companyId', '==', 'acme'))));
    const rival = member('rival-admin', 'rival');
    await assertFails(getDoc(doc(rival, 'suppliers/s1')));
    await assertFails(getDocs(query(collection(rival, 'suppliers'), where('companyId', '==', 'acme'))));
    await assertFails(getDocs(collection(staff, 'suppliers')));
  });

  it('blocks writing into another company', async () => {
    const rival = member('rival-admin', 'rival');
    await assertFails(setDoc(doc(rival, 'suppliers/x'), { id: 'x', companyId: 'acme', name: 'Evil' }));
    await assertFails(updateDoc(doc(rival, 'suppliers/s1'), { name: 'Hacked' }));
  });

  it('blocks suspended members and unapproved companies', async () => {
    await seedMember('acme-suspended', 'acme', 'ADMIN', { status: 'SUSPENDED' });
    await assertFails(getDoc(doc(member('acme-suspended', 'acme'), 'suppliers/s1')));
    await seedCompany('pending', { isApproved: false, status: 'PENDING' });
    await seedMember('pending-admin', 'pending', 'ADMIN');
    await seed('suppliers/p1', { id: 'p1', companyId: 'pending', name: 'P' });
    await assertFails(getDoc(doc(member('pending-admin', 'pending'), 'suppliers/p1')));
  });
});

describe('privilege escalation', () => {
  it('prevents users from changing their own role or company', async () => {
    const staff = member('acme-staff', 'acme');
    await assertFails(updateDoc(doc(staff, 'users/acme-staff'), { role: 'ADMIN' }));
    await assertFails(updateDoc(doc(staff, 'users/acme-staff'), { companyId: 'rival' }));
    await assertFails(updateDoc(doc(staff, 'users/acme-staff'), { status: 'ACTIVE', suspended: false }));
    await assertSucceeds(updateDoc(doc(staff, 'users/acme-staff'), { displayName: 'New Name' }));
  });

  it('prevents creating a profile that joins an arbitrary company', async () => {
    const attacker = as('attacker', 'attacker@mail.com');
    await assertFails(setDoc(doc(attacker, 'users/attacker'), {
      uid: 'attacker', email: 'attacker@mail.com', displayName: 'A', role: 'ADMIN', companyId: 'acme', status: 'ACTIVE', createdAt: now,
    }));
  });

  it('keeps platform admin status out of reach of clients', async () => {
    const admin = member('acme-admin', 'acme');
    await assertFails(setDoc(doc(admin, 'platform_admins/acme-admin'), { email: 'x' }));
    await assertFails(updateDoc(doc(admin, 'companies/acme'), { isApproved: true, subscriptionPlan: 'ENTERPRISE' }));
    await assertFails(updateDoc(doc(admin, 'companies/acme'), { enabledModules: [] }));
    await assertSucceeds(updateDoc(doc(admin, 'companies/acme'), { name: 'Acme Ltd' }));
  });

  it('stops managers from creating or promoting admins', async () => {
    const manager = member('acme-manager', 'acme');
    await assertFails(updateDoc(doc(manager, 'users/acme-staff'), { role: 'ADMIN' }));
    await assertSucceeds(updateDoc(doc(manager, 'users/acme-staff'), { role: 'ACCOUNT' }));
    await assertFails(updateDoc(doc(manager, 'users/acme-admin'), { status: 'SUSPENDED' }));
    const admin = member('acme-admin', 'acme');
    await assertSucceeds(updateDoc(doc(admin, 'users/acme-manager'), { status: 'SUSPENDED' }));
  });

  it('lets platform admins manage everything', async () => {
    await seed('platform_admins/root', { email: 'root@platform.com' });
    const root = as('root', 'root@platform.com');
    await assertSucceeds(updateDoc(doc(root, 'companies/acme'), { subscriptionPlan: 'BASIC' }));
    await assertSucceeds(getDocs(collection(root, 'users')));
  });
});

describe('company registration and invites', () => {
  it('allows a verified user to register a pending company and become its admin', async () => {
    const owner = as('founder', 'founder@new.com');
    const batch = writeBatch(owner);
    batch.set(doc(owner, 'companies/newco'), {
      id: 'newco', name: 'NewCo', ownerUid: 'founder', ownerEmail: 'founder@new.com', createdAt: now, isApproved: false, status: 'PENDING', requestedPlan: 'BASIC',
    });
    batch.set(doc(owner, 'users/founder'), {
      uid: 'founder', email: 'founder@new.com', displayName: 'F', role: 'ADMIN', companyId: 'newco', status: 'ACTIVE', createdAt: now, lastPasswordUpdate: now,
    });
    await assertSucceeds(batch.commit());
  });

  it('refuses self-approval and unverified registration', async () => {
    const unverified = env.authenticatedContext('u2', { email: 'u2@new.com', email_verified: false, firebase: { sign_in_provider: 'password' } }).firestore();
    await assertFails(setDoc(doc(unverified, 'companies/c2'), {
      id: 'c2', name: 'C2', ownerUid: 'u2', ownerEmail: 'u2@new.com', createdAt: now, isApproved: false, status: 'PENDING',
    }));
    const owner = as('u3', 'u3@new.com');
    await assertFails(setDoc(doc(owner, 'companies/c3'), {
      id: 'c3', name: 'C3', ownerUid: 'u3', ownerEmail: 'u3@new.com', createdAt: now, isApproved: true, status: 'ACTIVE',
    }));
  });

  it('lets an invited, verified user join with exactly the invited role', async () => {
    const manager = member('acme-manager', 'acme');
    const inviteId = 'acme__new.person@mail.com';
    await assertSucceeds(setDoc(doc(manager, `invites/${inviteId}`), {
      id: inviteId, companyId: 'acme', companyName: 'Acme', email: 'new.person@mail.com', role: 'STAFF', staffId: 'st1',
      assignedWarehouseId: null, status: 'PENDING', invitedByUid: 'acme-manager', invitedByEmail: 'acme-manager@acme.com', createdAt: now,
    }));

    const invitee = as('invitee', 'new.person@mail.com');
    const escalate = writeBatch(invitee);
    escalate.update(doc(invitee, `invites/${inviteId}`), { status: 'ACCEPTED', acceptedAt: now, acceptedByUid: 'invitee' });
    escalate.set(doc(invitee, 'users/invitee'), {
      uid: 'invitee', email: 'new.person@mail.com', displayName: 'N', role: 'ADMIN', companyId: 'acme', assignedWarehouseId: null, status: 'ACTIVE', createdAt: now, inviteId,
    });
    await assertFails(escalate.commit());

    const accept = writeBatch(invitee);
    accept.update(doc(invitee, `invites/${inviteId}`), { status: 'ACCEPTED', acceptedAt: now, acceptedByUid: 'invitee' });
    accept.set(doc(invitee, 'users/invitee'), {
      uid: 'invitee', email: 'new.person@mail.com', displayName: 'N', role: 'STAFF', companyId: 'acme', assignedWarehouseId: null, status: 'ACTIVE', createdAt: now, inviteId,
    });
    accept.update(doc(invitee, 'staff/st1'), { uid: 'invitee' });
    await assertSucceeds(accept.commit());
  });

  it('does not let managers invite admins', async () => {
    const manager = member('acme-manager', 'acme');
    const inviteId = 'acme__boss@mail.com';
    await assertFails(setDoc(doc(manager, `invites/${inviteId}`), {
      id: inviteId, companyId: 'acme', companyName: 'Acme', email: 'boss@mail.com', role: 'ADMIN', staffId: 'st1',
      status: 'PENDING', invitedByUid: 'acme-manager', invitedByEmail: 'm', createdAt: now,
    }));
  });
});

describe('role permissions on company data', () => {
  it('keeps auditors read-only', async () => {
    const auditor = member('acme-auditor', 'acme');
    await assertSucceeds(getDoc(doc(auditor, 'suppliers/s1')));
    await assertFails(setDoc(doc(auditor, 'transactions/t1'), {
      id: 't1', companyId: 'acme', type: 'PURCHASE', commodity: 'COCOA', netWeight: 10, grossWeight: 10, totalValue: 100, date: now,
    }));
  });

  it('lets staff post purchases but not edit or delete them', async () => {
    const staff = member('acme-staff', 'acme');
    await assertSucceeds(setDoc(doc(staff, 'transactions/t1'), {
      id: 't1', companyId: 'acme', type: 'PURCHASE', commodity: 'COCOA', netWeight: 10, grossWeight: 10, totalValue: 100, date: now,
    }));
    await assertFails(updateDoc(doc(staff, 'transactions/t1'), { totalValue: 1 }));
    await assertFails(updateDoc(doc(staff, 'transactions/t1'), {
      isDeleted: true, deletionReason: 'x', deletedByUid: 'acme-staff', deletedAt: now,
    }));
    await assertFails(setDoc(doc(staff, 'transactions/t2'), {
      id: 't2', companyId: 'acme', type: 'PURCHASE', commodity: 'COCOA', netWeight: -5, date: now,
    }));
  });

  it('requires admins to soft-delete with a reason and blocks hard deletes', async () => {
    await seed('transactions/t9', { id: 't9', companyId: 'acme', type: 'SALE', commodity: 'COCOA', netWeight: 5, totalValue: 50, date: now });
    const admin = member('acme-admin', 'acme');
    await assertFails(updateDoc(doc(admin, 'transactions/t9'), { isDeleted: true, deletedByUid: 'acme-admin', deletedAt: now }));
    await assertSucceeds(updateDoc(doc(admin, 'transactions/t9'), {
      isDeleted: true, deletionReason: 'Duplicate', deletedByUid: 'acme-admin', deletedBy: 'acme-admin@acme.com', deletedAt: now,
    }));
    await assertFails(updateDoc(doc(admin, 'transactions/t9'), { isDeleted: false }));
  });

  it('keeps audit logs append-only and unforgeable', async () => {
    const staff = member('acme-staff', 'acme');
    await assertFails(setDoc(doc(staff, 'audit_logs/l1'), {
      id: 'l1', companyId: 'acme', userId: 'acme-admin', action: 'CREATE', createdAt: serverTimestamp(),
    }));
    await assertSucceeds(setDoc(doc(staff, 'audit_logs/l2'), {
      id: 'l2', companyId: 'acme', userId: 'acme-staff', action: 'CREATE', createdAt: serverTimestamp(),
    }));
    const admin = member('acme-admin', 'acme');
    await assertFails(updateDoc(doc(admin, 'audit_logs/l2'), { details: 'edited' }));
    await assertFails(getDoc(doc(staff, 'audit_logs/l2')));
    await assertSucceeds(getDoc(doc(member('acme-auditor', 'acme'), 'audit_logs/l2')));
  });

  it('locks paid payroll', async () => {
    await seed('payrolls/2026-01_st1', {
      id: '2026-01_st1', companyId: 'acme', staffId: 'st1', month: '2026-01', status: 'PAID', grossIncome: 100, paye: 0, pension: 8, otherDeductions: 0, netPay: 92,
    });
    const admin = member('acme-admin', 'acme');
    await assertFails(updateDoc(doc(admin, 'payrolls/2026-01_st1'), { netPay: 1000 }));
  });

  it('scopes balance counters to the member company', async () => {
    const staff = member('acme-staff', 'acme');
    const id = 'acme~COMMODITY~w1~COCOA';
    await assertSucceeds(getDoc(doc(staff, `stock_balances/${id}`)));
    await assertSucceeds(setDoc(doc(staff, `stock_balances/${id}`), { id, companyId: 'acme', ledger: 'COMMODITY', warehouseId: 'w1', item: 'COCOA', quantity: 10 }));
    const rivalId = 'rival~COMMODITY~w1~COCOA';
    await assertFails(getDoc(doc(staff, `stock_balances/${rivalId}`)));
    await assertFails(setDoc(doc(staff, `stock_balances/${rivalId}`), { id: rivalId, companyId: 'acme', ledger: 'COMMODITY', warehouseId: 'w1', item: 'COCOA', quantity: 10 }));
  });
});
