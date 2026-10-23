/**
 * The auth service this product signs people in with — the one place it is
 * chosen. The API Worker builds it and the migrate runner applies its schema;
 * everything else holds it only as the `@pkgs/auth` port. Moving to another
 * service (Clerk, Firebase Auth, WorkOS, Cognito, Better Auth, …) is a new
 * adapter package, this line, and the client adapter the wall and harness
 * `ClientEnv`s build.
 *
 * Emailed sign-in links go to exactly one place: the Synthetic Population's
 * internal inbox. It accepts Synthetic User addresses only and sends nothing
 * anywhere, in every environment, so no person can ever be mailed a link.
 */

import { syntheticPopulationSignInMail } from '@libs/synthetic-population-server-ts/sign-in-inbox';
import { inhouseAuthProviderWith } from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import type { AuthProviderModule } from '@pkgs/auth-root-shared-ts/auth-provider-module';

export const APP_AUTH_PROVIDER: AuthProviderModule = inhouseAuthProviderWith({
  emailLinks: (env) =>
    syntheticPopulationSignInMail({
      getDb: env.getSql,
      ports: { clock: env.clock, createId: env.createId },
    }),
});
