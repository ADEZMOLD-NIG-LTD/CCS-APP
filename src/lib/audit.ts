import type { WriteOp } from './writes';
import { serverTimestamp } from './fs';
import { newId } from './utils';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export interface AuditActor {
  companyId: string;
  uid: string;
  email: string;
}

export interface AuditLogParams {
  action: AuditAction;
  module: string;
  recordId: string;
  details: string;
  previousData?: unknown;
  newData?: unknown;
}

const MAX_SNAPSHOT_CHARS = 20_000;

/** Makes a JSON-safe, size-bounded copy of a record for the audit trail. */
function snapshot(data: unknown): unknown {
  if (data === undefined || data === null) return null;
  try {
    const json = JSON.stringify(data, (_key, value) => {
      if (value && typeof value === 'object' && typeof value.toDate === 'function') return value.toDate().toISOString();
      return value;
    });
    if (json.length > MAX_SNAPSHOT_CHARS) return { truncated: true, preview: json.slice(0, MAX_SNAPSHOT_CHARS) };
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Builds the audit-log write so it can be committed atomically with the change it
 * describes. Firestore rules require userId to match the signed-in user and createdAt to be
 * the server time, so entries cannot be forged or back-dated; they can never be edited or deleted.
 */
export function auditOp(actor: AuditActor, params: AuditLogParams): WriteOp {
  const id = newId();
  return {
    kind: 'set',
    collection: 'audit_logs',
    id,
    data: {
      id,
      companyId: actor.companyId,
      userId: actor.uid,
      userEmail: actor.email,
      action: params.action,
      module: params.module,
      recordId: params.recordId,
      details: params.details,
      previousData: snapshot(params.previousData),
      newData: snapshot(params.newData),
      timestamp: new Date().toISOString(),
      createdAt: serverTimestamp(),
    },
  };
}
