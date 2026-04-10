import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './firestore';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

export interface AuditLogParams {
  companyId: string;
  userId: string;
  userEmail: string;
  action: AuditAction;
  module: string;
  recordId: string;
  details: string;
  previousData?: any;
  newData?: any;
}

function sanitizeForFirestore(data: any): any {
  if (data === undefined) return null;
  if (data === null) return null;
  if (Array.isArray(data)) return data.map(sanitizeForFirestore);
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        const value = data[key];
        if (value !== undefined) {
          sanitized[key] = sanitizeForFirestore(value);
        }
      }
    }
    return sanitized;
  }
  return data;
}

export async function recordAuditLog(params: AuditLogParams) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const log = sanitizeForFirestore({
    id,
    ...params,
    timestamp
  });

  try {
    await setDoc(doc(db, 'audit_logs', id), log);
  } catch (error) {
    // We log the error but don't necessarily want to block the main operation
    // unless it's critical. For now, we'll use the standard error handler.
    console.error('Failed to record audit log:', error);
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}
