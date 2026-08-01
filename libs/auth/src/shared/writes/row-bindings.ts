/**
 * Auth table upload policies live in `apps/api` (table policies / rules).
 * Deny codes for server-managed tables are exported from `@libs/auth/shared/rules/codes`.
 */
export {
  AUTH_DEVICE_ID_MISMATCH,
  AUTH_DEVICE_REQUIRED,
  AUTH_SERVER_MANAGED,
} from '@libs/auth/shared/rules/codes';
