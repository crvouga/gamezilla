import type { AuthErrorBody } from '@pkgs/sync-engine-shared-ts/v2';

export function isAuthErrorBody(v: unknown): v is AuthErrorBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    'error' in v &&
    (v as AuthErrorBody).error === 'auth'
  );
}
