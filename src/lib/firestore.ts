import { logger } from './logger';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export class OfflineError extends Error {
  constructor() {
    super("You're offline. Reconnect to the internet and try again — nothing was saved.");
    this.name = 'OfflineError';
  }
}

export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientBalanceError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code.replace(/^firestore\//, '') : undefined;
  }
  return undefined;
}

/** Converts any error into a message that is safe and useful to show a user. */
export function formatFirestoreError(error: unknown): string {
  if (error instanceof OfflineError || error instanceof InsufficientBalanceError || error instanceof ValidationError) {
    return error.message;
  }
  switch (errorCode(error)) {
    case 'permission-denied':
      return "You don't have permission to perform this action. If you think this is wrong, ask your company admin.";
    case 'unauthenticated':
      return 'Your session has expired. Please sign in again.';
    case 'unavailable':
    case 'deadline-exceeded':
      return 'The database could not be reached. Check your connection and try again.';
    case 'aborted':
      return 'Another user changed this record at the same time. Please try again.';
    case 'failed-precondition':
      return 'The database rejected this request (a required index may still be building). Please try again shortly.';
    case 'resource-exhausted':
      return 'The database quota has been exceeded. Please try again later.';
    case 'not-found':
      return 'The record no longer exists. Refresh and try again.';
    default:
      break;
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Please try again.';
}

export function reportFirestoreError(error: unknown, operationType: OperationType, path: string | null): string {
  logger.error(`Firestore ${operationType} failed${path ? ` (${path})` : ''}:`, errorCode(error) || error);
  return formatFirestoreError(error);
}

export function isPermissionDenied(error: unknown): boolean {
  return errorCode(error) === 'permission-denied';
}
