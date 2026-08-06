import type { AuthErrorBody } from '../queries/core/types';

export function isAuthErrorBody(v: unknown): v is AuthErrorBody {
  return (
    typeof v === 'object' &&
    v !== null &&
    'error' in v &&
    (v as AuthErrorBody).error === 'auth'
  );
}
