/**
 * The auth service this product signs people in with — the one place it is
 * chosen. The API Worker builds it and the migrate runner applies its schema;
 * everything else holds it only as the `@pkgs/auth` port. Moving to another
 * service (Clerk, Firebase Auth, WorkOS, Cognito, Better Auth, …) is a new
 * adapter package, this line, and the client adapter the wall and harness
 * `ClientEnv`s build.
 */
import type { AuthProviderModule } from '@pkgs/auth/server';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse/server';

export const APP_AUTH_PROVIDER: AuthProviderModule = INHOUSE_AUTH_PROVIDER;
