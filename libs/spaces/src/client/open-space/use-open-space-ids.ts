import { asKeyword, joinKeywordSegments } from '@pkgs/keyword/keyword';
import { jsonKvCodec } from '@pkgs/kv/kv-state-codec';
import { useKvState } from '@pkgs/kv/use-kv-state';
import { useCallback, useMemo } from 'react';

import { useMyAccountId } from '@libs/auth/client/use-current-user';

const OPEN_SPACES_VALUE_ATTR = asKeyword('spaces.open/ids');

function isStringArray(v: unknown): v is string[] {
  return (
    Array.isArray(v) &&
    v.every((item) => typeof item === 'string' && item.length > 0)
  );
}

const openSpacesCodec = jsonKvCodec<string[]>(
  OPEN_SPACES_VALUE_ATTR,
  isStringArray
);

/** Encode account id into a wire-valid keyword namespace (UUIDs may start with a digit). */
function openSpacesKey(accountId: string) {
  const body = accountId.toLowerCase().replace(/[^a-z0-9]/g, '');
  const seg = body.length > 0 ? `a${body}` : 'ax';
  const ns = joinKeywordSegments('spaces', 'open', seg);
  return asKeyword(`${ns}/ids`);
}

/**
 * Local durable set of space ids this install currently has open.
 * Drives miniplayer + presence; not synced via PowerSync.
 */
export function useOpenSpaceIds(): {
  readonly openSpaceIds: readonly string[];
  readonly isOpen: (spaceId: string) => boolean;
  readonly markOpen: (spaceId: string) => void;
  readonly markClosed: (spaceId: string) => void;
} {
  const accountId = useMyAccountId();
  const key =
    accountId !== null && accountId.length > 0
      ? openSpacesKey(accountId)
      : asKeyword('spaces.open/anon');
  const [ids, setIds] = useKvState<string[]>({
    key,
    default: [],
    codec: openSpacesCodec,
    persist: accountId !== null && accountId.length > 0,
  });

  const openSet = useMemo(() => new Set(ids), [ids]);

  const isOpen = useCallback(
    (spaceId: string) => spaceId.length > 0 && openSet.has(spaceId),
    [openSet]
  );

  const markOpen = useCallback(
    (spaceId: string) => {
      if (spaceId.length === 0) return;
      setIds((prev) => (prev.includes(spaceId) ? prev : [spaceId, ...prev]));
    },
    [setIds]
  );

  const markClosed = useCallback(
    (spaceId: string) => {
      if (spaceId.length === 0) return;
      setIds((prev) => prev.filter((id) => id !== spaceId));
    },
    [setIds]
  );

  return { openSpaceIds: ids, isOpen, markOpen, markClosed };
}
