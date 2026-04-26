import { createGamezillaApiClient } from '@gamezilla/client/api/hc';
import {
  assertPrincipalId,
  PRINCIPAL_ENTITY_TYPE,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalAttr,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { assertUuid } from '@gamezilla/domain/auth/principal-id';
import type { ConfigService } from '@gamezilla/domain/config/config-service';
import { assert } from '@gamezilla/lib/assert';
import type { InjectionToken } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { AuthConfigurationError } from './auth-errors';
import type { PrincipalService } from './principal-service';
import type { SessionService } from './session-service';

export interface AuthService {
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthServiceToken: InjectionToken<AuthService> =
  Symbol('AuthService');

type ClaimResponse = {
  accountId: string;
  sessionToken: string;
  expiresAt: string;
};

type CreateAuthServiceDeps = {
  configService: ConfigService;
  principalService: PrincipalService;
  db: PatchesDb;
  sessionService: SessionService;
  /** When false, sign-in is refused before opening the Google prompt. */
  googleSignInAvailable: boolean;
  promptGoogleIdToken: () => Promise<string>;
};

function parseClaimResponse(json: unknown): ClaimResponse {
  assert.record(json, 'claim response must be object');
  const accountId = json['accountId'];
  const sessionToken = json['sessionToken'];
  const expiresAt = json['expiresAt'];
  assert.string(accountId, 'claim response accountId must be string');
  assert.string(sessionToken, 'claim response sessionToken must be string');
  assert.string(expiresAt, 'claim response expiresAt must be string');
  assertUuid(accountId, 'claim response accountId must be UUID');
  assert.ok(
    sessionToken.length > 0,
    'claim response sessionToken must be non-empty'
  );
  return { accountId, sessionToken, expiresAt };
}

function createGoogleSignInHandler(
  deps: CreateAuthServiceDeps
): AuthService['signInWithGoogle'] {
  const {
    configService,
    principalService,
    db,
    googleSignInAvailable,
    promptGoogleIdToken,
  } = deps;

  return async function signInWithGoogle(): Promise<void> {
    if (!googleSignInAvailable) {
      throw new AuthConfigurationError();
    }
    const googleIdToken = await promptGoogleIdToken();
    assert.string(googleIdToken, 'Google id_token must be string');
    assert.ok(googleIdToken.length > 0, 'Google id_token must be non-empty');

    const principalId = principalService.getPrincipalId();
    assertPrincipalId(principalId);

    const apiUrl = configService.getApiUrl();
    const client = createGamezillaApiClient(apiUrl);
    const response = await client.auth.claim.$post({
      json: { googleIdToken, principalId },
    });

    const text = await response.text();
    let json: unknown;
    try {
      json = text.length > 0 ? (JSON.parse(text) as unknown) : null;
    } catch {
      throw new Error(
        `Claim response was not JSON (status ${String(response.status)})`
      );
    }

    if (!response.ok) {
      throw new Error(`Claim failed (${String(response.status)}): ${text}`);
    }

    assert.ok(json !== null, 'claim success body must not be empty');
    const { accountId, sessionToken, expiresAt } = parseClaimResponse(json);

    const sessionEntityId = globalThis.crypto.randomUUID();

    await db.write([
      {
        entityId: principalId,
        entityType: PRINCIPAL_ENTITY_TYPE,
        attributes: {
          [PrincipalAttr.accountId]: accountId,
        },
      },
      {
        entityId: sessionEntityId,
        entityType: PRINCIPAL_SESSION_ENTITY_TYPE,
        attributes: {
          [PrincipalSessionAttr.principalId]: principalId,
          [PrincipalSessionAttr.accountId]: accountId,
          [PrincipalSessionAttr.token]: sessionToken,
          [PrincipalSessionAttr.expiresAt]: expiresAt,
          [PrincipalSessionAttr.createdAt]: new Date().toISOString(),
        },
      },
    ]);

    await deps.sessionService.refresh();
  };
}

export function createAuthService(deps: CreateAuthServiceDeps): AuthService {
  return {
    signInWithGoogle: createGoogleSignInHandler(deps),
    async signOut(): Promise<void> {
      await deps.sessionService.clearSession();
    },
  };
}
