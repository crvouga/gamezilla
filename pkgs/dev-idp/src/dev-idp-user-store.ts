/**
 * Durable {@link DevIdpUserStore} backed by an injected {@link Kv}.
 *
 * `Kv` has no `scan`, so every user lives in a single {@link KvRecord} at
 * {@link DEV_IDP_USERS_KEY}. The record body holds one attribute whose value
 * is a `Record<sub, UserProfile>` (encoded as a JSON attribute). All
 * mutations go through `kv.tx(get -> apply -> put)` so concurrent
 * create/update/delete calls never lose writes.
 */
import { assert } from '@pkgs/assert';
import { createAttrNamespace } from '@pkgs/attribute';
import { asKeyword, type Keyword } from '@pkgs/keyword/keyword';
import type { Kv, KvRecord } from '@pkgs/kv/interface';

/** Public test-user profile (OIDC-ish claim subset). */
export type DevIdpUserProfile = {
  readonly sub: string;
  readonly email: string;
  readonly name: string;
  readonly picture: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

/** Mutable input for {@link DevIdpUserStore.create}. */
export type DevIdpUserCreateInput = {
  readonly email: string;
  readonly name: string;
  readonly picture?: string | null;
  /** Stable id. Auto-generated when omitted. */
  readonly sub?: string;
};

/** Mutable input for {@link DevIdpUserStore.update}. */
export type DevIdpUserPatch = {
  readonly email?: string;
  readonly name?: string;
  readonly picture?: string | null;
};

/** KV key holding every test user (single-record encoding — see file header). */
export const DEV_IDP_USERS_KEY: Keyword = asKeyword('dev-idp.kv/users');

const UsersNs = createAttrNamespace('dev-idp', 'users-record');

type UsersTable = Record<string, DevIdpUserProfile>;

function parseUsersTable(v: unknown): UsersTable {
  if (v === null || v === undefined) return {};
  assert.ok(
    typeof v === 'object' && !Array.isArray(v),
    'dev-idp users record: data must be a plain object'
  );
  const out: UsersTable = {};
  for (const [sub, raw] of Object.entries(v as Record<string, unknown>)) {
    const profile = readProfile(raw);
    if (profile !== null) out[sub] = profile;
  }
  return out;
}

function readProfile(raw: unknown): DevIdpUserProfile | null {
  if (raw === null || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sub = readString(r['sub']);
  const email = readString(r['email']);
  const name = readString(r['name']);
  if (sub === null || email === null || name === null) return null;
  const picture = readNullableString(r['picture']);
  const createdAt = readString(r['createdAt']) ?? new Date(0).toISOString();
  const updatedAt = readString(r['updatedAt']) ?? createdAt;
  return { sub, email, name, picture, createdAt, updatedAt };
}

function readString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const UsersAttr = {
  data: UsersNs.json('data', parseUsersTable),
} as const;

function encodeUsersTable(table: UsersTable): KvRecord {
  return UsersAttr.data(table as unknown as Record<string, unknown>);
}

async function readTable(kv: Kv): Promise<UsersTable> {
  const record = await kv.get(DEV_IDP_USERS_KEY);
  if (record === null) return {};
  return UsersAttr.data.from(record);
}

function nowIso(): string {
  return new Date().toISOString();
}

function makeSub(): string {
  return globalThis.crypto.randomUUID();
}

/** CRUD store over the injected {@link Kv}. Stateless; safe to construct per request. */
export class DevIdpUserStore {
  constructor(private readonly kv: Kv) {}

  async list(): Promise<DevIdpUserProfile[]> {
    const table = await readTable(this.kv);
    return Object.values(table).sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.sub.localeCompare(b.sub)
    );
  }

  async get(sub: string): Promise<DevIdpUserProfile | null> {
    const table = await readTable(this.kv);
    return table[sub] ?? null;
  }

  async create(input: DevIdpUserCreateInput): Promise<DevIdpUserProfile> {
    assert.nonEmptyString(input.email, 'dev-idp create: email required');
    assert.nonEmptyString(input.name, 'dev-idp create: name required');
    const sub = input.sub ?? makeSub();
    const now = nowIso();
    const profile: DevIdpUserProfile = {
      sub,
      email: input.email.trim(),
      name: input.name.trim(),
      picture: input.picture === undefined ? null : input.picture,
      createdAt: now,
      updatedAt: now,
    };
    await this.kv.tx(async (tx) => {
      const table = await readTable(tx);
      table[sub] = profile;
      await tx.put(DEV_IDP_USERS_KEY, encodeUsersTable(table));
    });
    return profile;
  }

  async update(
    sub: string,
    patch: DevIdpUserPatch
  ): Promise<DevIdpUserProfile | null> {
    let next: DevIdpUserProfile | null = null;
    await this.kv.tx(async (tx) => {
      const table = await readTable(tx);
      const current = table[sub];
      if (current === undefined) return;
      next = applyPatch(current, patch);
      table[sub] = next;
      await tx.put(DEV_IDP_USERS_KEY, encodeUsersTable(table));
    });
    return next;
  }

  async delete(sub: string): Promise<boolean> {
    let deleted = false;
    await this.kv.tx(async (tx) => {
      const table = await readTable(tx);
      if (table[sub] === undefined) return;
      delete table[sub];
      deleted = true;
      await tx.put(DEV_IDP_USERS_KEY, encodeUsersTable(table));
    });
    return deleted;
  }

  /**
   * Idempotent seed: creates any of `seeds` not already present (by `sub`).
   * Returns the final {@link list} ordering.
   */
  async seedIfEmpty(
    seeds: readonly DevIdpUserCreateInput[]
  ): Promise<DevIdpUserProfile[]> {
    await this.kv.tx(async (tx) => {
      const table = await readTable(tx);
      if (Object.keys(table).length > 0) return;
      const now = nowIso();
      for (const seed of seeds) {
        const sub = seed.sub ?? makeSub();
        table[sub] = {
          sub,
          email: seed.email.trim(),
          name: seed.name.trim(),
          picture: seed.picture === undefined ? null : seed.picture,
          createdAt: now,
          updatedAt: now,
        };
      }
      await tx.put(DEV_IDP_USERS_KEY, encodeUsersTable(table));
    });
    return this.list();
  }
}

function applyPatch(
  current: DevIdpUserProfile,
  patch: DevIdpUserPatch
): DevIdpUserProfile {
  const email = patch.email !== undefined ? patch.email.trim() : current.email;
  const name = patch.name !== undefined ? patch.name.trim() : current.name;
  const picture =
    patch.picture === undefined ? current.picture : patch.picture;
  return {
    sub: current.sub,
    email,
    name,
    picture,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
  };
}
