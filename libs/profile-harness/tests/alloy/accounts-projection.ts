/**
 * Stored identity rows as a world of `specs/profile/accounts.als`. Only live
 * rows count: a tombstoned profile, link or device membership is not in the
 * product world.
 *
 * - `Profile`: a live profile row; `username` its saved username (as saved:
 *   the model leaves letter case out), `avatar` its saved avatar settings.
 * - `Username` / `Avatar`: the distinct saved values; an avatar is its
 *   settings, compared canonically (key order does not make a new one).
 * - `Account`: a live user that is not a guest (`is_anon` false); `profile`
 *   its own profile row (the product keys both by the user id).
 * - `GoogleAccount` / `AppleAccount` and `signsInto`: every live link the
 *   store keeps between an outside account (provider + its subject id) and
 *   an account. Both stores keep the linked-sign-in-method rows; the server
 *   also keeps the identity provider's own accounts, joined to the account
 *   through the identity link. Both are read, so the two records disagreeing
 *   about an outside account shows as it signing into two accounts.
 * - `Device`: every device the store holds a live row for (or a live
 *   account membership names); `account` a live device-in-account row
 *   ("live while it is signed in there, tombstoned when it leaves").
 */

import type { Names, Store, World } from '@libs/harness/snapshot-worlds';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';

type Pair = readonly [string, string];

type ProfileRow = {
  readonly id: string;
  readonly username: string | null;
  readonly avatar_config: unknown;
};

type LinkRow = {
  readonly provider: string;
  readonly subject: string;
  readonly user_id: string | null;
};

const OUTSIDE_SIG: Readonly<Record<string, string>> = {
  google: 'GoogleAccount',
  apple: 'AppleAccount',
};

function sortedSet(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function sortedPairs(pairs: Iterable<Pair>): Pair[] {
  const byKey = new Map<string, Pair>();
  for (const pair of pairs) byKey.set(JSON.stringify(pair), pair);
  return [...byKey.keys()].sort().map((key) => byKey.get(key) as Pair);
}

/** Settings with their keys in one order, whatever order they were saved in. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonical((value as Record<string, unknown>)[key])])
  );
}

function avatarAtom(config: unknown): string {
  const parsed = typeof config === 'string' ? JSON.parse(config) : config;
  return `avatar ${JSON.stringify(canonical(parsed))}`;
}

const usernameAtom = (username: string) => `@${username}`;
const profileAtom = (names: Names, id: string) => `profile of ${names(id)}`;
const accountAtom = (names: Names, id: string) => `account of ${names(id)}`;
const outsideAtom = (link: LinkRow) => `${link.provider} ${link.subject}`;

async function profileRows(db: SqlTx): Promise<readonly ProfileRow[]> {
  return db.query(sql<ProfileRow>`
    SELECT id, username, avatar_config FROM profile
    WHERE deleted_at IS NULL`);
}

async function accountIds(db: SqlTx): Promise<readonly string[]> {
  const rows = await db.query(sql<{
    readonly id: string;
    readonly is_anon: unknown;
  }>`
    SELECT id, is_anon FROM auth_users WHERE deleted_at IS NULL`);
  return rows
    .filter((row) => row.is_anon === false || row.is_anon === 0)
    .map((row) => row.id);
}

/** The linked-sign-in-method rows, which both stores keep. */
async function methodLinks(db: SqlTx): Promise<readonly LinkRow[]> {
  return db.query(sql<LinkRow>`
    SELECT provider, external_id AS subject, user_id
    FROM auth_external_accounts
    WHERE deleted_at IS NULL AND provider IN ('google', 'apple')`);
}

/** The identity provider's own accounts, which only the server keeps. */
async function identityProviderLinks(db: SqlTx): Promise<readonly LinkRow[]> {
  return db.query(sql<LinkRow>`
    SELECT a.provider, a.provider_user_id AS subject, x.user_id
    FROM idp_accounts AS a
    LEFT JOIN auth_external_accounts AS x
      ON x.provider = 'idp' AND x.external_id = a.user_id
      AND x.deleted_at IS NULL
    WHERE a.deleted_at IS NULL AND a.provider IN ('google', 'apple')`);
}

async function deviceRows(db: SqlTx) {
  const devices = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM auth_devices WHERE deleted_at IS NULL`);
  const memberships = await db.query(sql<{
    readonly device_id: string;
    readonly user_id: string;
  }>`
    SELECT device_id, user_id FROM auth_account_devices
    WHERE deleted_at IS NULL`);
  return { devices, memberships };
}

function outsideAccounts(links: readonly LinkRow[], names: Names) {
  const atoms: Record<string, string[]> = {
    GoogleAccount: [],
    AppleAccount: [],
  };
  for (const link of links)
    atoms[OUTSIDE_SIG[link.provider] ?? '']?.push(outsideAtom(link));
  const signsInto = links.flatMap((link) =>
    link.user_id === null
      ? []
      : [[outsideAtom(link), accountAtom(names, link.user_id)] as const]
  );
  return {
    atoms: Object.fromEntries(
      Object.entries(atoms).map(([sig, ids]) => [sig, sortedSet(ids)])
    ),
    signsInto: sortedPairs(signsInto),
  };
}

export async function projectAccounts(
  db: SqlTx,
  names: Names,
  store: Store
): Promise<World> {
  const profiles = await profileRows(db);
  const accounts = await accountIds(db);
  const links = [
    ...(await methodLinks(db)),
    ...(store === 'server' ? await identityProviderLinks(db) : []),
  ];
  const outside = outsideAccounts(links, names);
  const { devices, memberships } = await deviceRows(db);
  const profileIds = new Set(profiles.map((p) => p.id));
  const named = profiles.flatMap((p) =>
    p.username === null ? [] : [[p, p.username] as const]
  );
  return {
    atoms: {
      Username: sortedSet(named.map(([, u]) => usernameAtom(u))),
      Avatar: sortedSet(profiles.map((p) => avatarAtom(p.avatar_config))),
      Profile: sortedSet(profiles.map((p) => profileAtom(names, p.id))),
      Account: sortedSet(accounts.map((id) => accountAtom(names, id))),
      ...outside.atoms,
      Device: sortedSet(
        [
          ...devices.map((d) => d.id),
          ...memberships.map((m) => m.device_id),
        ].map(names)
      ),
    },
    relations: {
      username: sortedPairs(
        named.map(
          ([p, u]) => [profileAtom(names, p.id), usernameAtom(u)] as const
        )
      ),
      avatar: sortedPairs(
        profiles.map(
          (p) =>
            [profileAtom(names, p.id), avatarAtom(p.avatar_config)] as const
        )
      ),
      profile: sortedPairs(
        accounts
          .filter((id) => profileIds.has(id))
          .map(
            (id) => [accountAtom(names, id), profileAtom(names, id)] as const
          )
      ),
      signsInto: outside.signsInto,
      account: sortedPairs(
        memberships.map(
          (m) => [names(m.device_id), accountAtom(names, m.user_id)] as const
        )
      ),
    },
  };
}
