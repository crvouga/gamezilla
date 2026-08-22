export function isPostgresConnectionLimitError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  if (
    msg.includes('too many clients') ||
    msg.includes('remaining connection slots')
  ) {
    return true;
  }
  const code = (error as { code?: string }).code;
  return code === '53300';
}

export function isPostgresDeadlockError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  if (code === '40P01') return true;
  return error.message.toLowerCase().includes('deadlock detected');
}

export function isPostgresLockTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  if (code === '55P03') return true;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('lock timeout') ||
    msg.includes('canceling statement due to lock')
  );
}

export function isPostgresTransientMigrateError(error: unknown): boolean {
  return (
    isPostgresConnectionLimitError(error) ||
    isPostgresDeadlockError(error) ||
    isPostgresLockTimeoutError(error)
  );
}

export function transientMigrateRetryReason(error: unknown): string {
  if (isPostgresDeadlockError(error)) return 'deadlock';
  if (isPostgresLockTimeoutError(error)) return 'lock timeout';
  return 'connection limit';
}
