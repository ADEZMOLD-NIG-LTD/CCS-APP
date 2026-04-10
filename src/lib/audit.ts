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

export async function recordAuditLog(params: AuditLogParams) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  const log = {
    id,
    ...params,
    timestamp
  };

  try {
    await setDoc(doc(db, 'audit_logs', id), log);
  } catch (error) {
    // We log the error but don't necessarily want to block the main operation
    // unless it's critical. For now, we'll use the standard error handler.
    console.error('Failed to record audit log:', error);
    handleFirestoreError(error, OperationType.CREATE, `audit_logs/${id}`);
  }
}
