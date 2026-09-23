/**
 * The signed-in account's sign-in methods, read from local SQLite: the IdP's
 * identities are mirrored into `auth_external_accounts` (one row per
 * provider) by `/identity/refresh`, so this is ordinary synced data.
 */

import { isOauthProviderId, type OauthProviderId } from '@pkgs/auth/shared';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { type Accessor, createMemo } from 'solid-js';

import { useHasAuthSession } from '../../../public/access-facts';
import { useMyId } from '../../../public/use-current-user';

export type LinkedIdentity = {
  readonly provider: OauthProviderId;
  readonly email: string | null;
  readonly emailVerified: boolean;
  readonly isPrivateEmail: boolean;
  readonly emailForwarding: boolean;
};

type Row = {
  readonly provider: string;
  readonly metadata: unknown;
};

function metadataOf(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed !== null && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return raw !== null && typeof raw === 'object'
    ? (raw as Record<string, unknown>)
    : {};
}

function toIdentity(row: Row): LinkedIdentity | null {
  if (!isOauthProviderId(row.provider)) return null;
  const meta = metadataOf(row.metadata);
  return {
    provider: row.provider,
    email: typeof meta['email'] === 'string' ? meta['email'] : null,
    emailVerified: meta['emailVerified'] === true,
    isPrivateEmail: meta['isPrivateEmail'] === true,
    emailForwarding: meta['emailForwarding'] !== false,
  };
}

export function useLinkedIdentities(): Accessor<readonly LinkedIdentity[]> {
  const hasSession = useHasAuthSession();
  const userId = useMyId();
  const watchId = createMemo(() =>
    hasSession() && userId().length > 0 ? userId() : ''
  );
  const rows = createQuery(
    () => sql<Row>`
    SELECT provider, metadata
    FROM auth_external_accounts
    WHERE user_id = ${watchId()}
      AND provider IN ('google', 'apple')
      AND deleted_at IS NULL
    ORDER BY provider
  `
  );
  return createMemo(() =>
    rows
      .rows()
      .map(toIdentity)
      .filter((row): row is LinkedIdentity => row !== null)
  );
}
