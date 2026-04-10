import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function reportFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  return formatFirestoreError(new Error(JSON.stringify(errInfo)));
}

export function formatFirestoreError(error: unknown): string {
  let message = '';
  if (error instanceof Error) {
    try {
      // Try to parse if it's our custom JSON error
      const parsed = JSON.parse(error.message) as FirestoreErrorInfo;
      if (parsed.error && parsed.operationType) {
        if (parsed.error.includes('insufficient permissions')) {
          return `Permission Denied: You don't have access to ${parsed.operationType} this data.`;
        }
        return `Database Error: ${parsed.error} (${parsed.operationType})`;
      }
      message = error.message;
    } catch {
      message = error.message;
    }
  } else {
    message = String(error);
  }

  if (message.includes('insufficient permissions')) {
    return "Permission Denied: You don't have the required permissions for this action.";
  }
  if (message.includes('offline') || message.includes('Failed to get document because the client is offline')) {
    return "Working Offline: Your changes are saved locally and will sync once network is restored.";
  }
  if (message.includes('quota exceeded')) {
    return "Database Error: Daily quota exceeded. Please try again tomorrow.";
  }

  return message;
}
