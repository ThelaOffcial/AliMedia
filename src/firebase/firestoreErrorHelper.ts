/**
 * Error helper for Firebase Realtime Database operations.
 * Kept for compatibility with existing imports.
 */

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  GET = 'get',
  LIST = 'list',
  WRITE = 'write',
  READ = 'read',
}

export interface DbErrorInfo {
  code?: string;
  message?: string;
  operation: OperationType;
  path: string;
}

export function handleFirestoreError(
  error: any,
  operation: OperationType,
  path: string
): void {
  const errInfo: DbErrorInfo = {
    code: error?.code,
    message: error?.message,
    operation,
    path,
  };
  console.error('Realtime Database Error: ', JSON.stringify(errInfo));
}

export const handleDbError = handleFirestoreError;
