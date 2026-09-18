import { sql } from '@pkgs/sql';
import {
  defineMutation,
  type MutationDb,
  MutationError,
} from '@pkgs/sync-engine/shared';
import { z } from 'zod';
import { applyPreferredUsernameIfAvailable } from '../../../shared/profile/apply-preferred-username';
import { assignUniqueUsernameIfEmpty } from '../../../shared/profile/assign-unique-username';
import {
  parseAvatarConfig,
  serializeAvatarConfig,
  serializeDefaultAvatarConfig,
} from '../../../shared/profile/avatar-config';
import {
  USERNAME_NORM_UNIQUE_INDEX,
  USERNAME_TAKEN_CONSTRAINT_ERROR,
} from '../../../shared/profile/username-column';
import { generateRandomUsername } from '../../../shared/profile/username-generator';

const avatarConfigArgs = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

const PROFILE_SEED_USERNAME_ATTEMPTS = 8;

function avatarConfigJson(value: z.infer<typeof avatarConfigArgs>): string {
  const avatarConfig = parseAvatarConfig(value);
  if (avatarConfig === null) {
    throw new MutationError(
      'INVALID_AVATAR_CONFIG',
      'Avatar configuration is invalid.'
    );
  }
  return serializeAvatarConfig(avatarConfig);
}

async function seedProfile(
  tx: MutationDb,
  profileId: string,
  now: string,
  avatarConfig: string
): Promise<void> {
  let username = '';
  for (
    let attempt = 0;
    attempt < PROFILE_SEED_USERNAME_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = generateRandomUsername(`${profileId}:seed:${attempt}`);
    const taken = await tx.query(sql<{ one: number }>`
      SELECT 1 AS one
      FROM profile
      WHERE lower(username) = ${candidate.toLowerCase()}
        AND username <> ''
      LIMIT 1
    `);
    if (taken.length > 0) continue;
    username = candidate;
    break;
  }
  if (username.length === 0) {
    throw new MutationError(
      'USERNAME_TAKEN',
      'Could not assign a unique username.'
    );
  }
  await tx.run(sql`
    INSERT INTO profile (id, created_at, username, username_norm, avatar_config)
    VALUES (
      ${profileId},
      ${now},
      ${username},
      ${username.toLowerCase()},
      ${avatarConfig}
    )
    ON CONFLICT (id) DO NOTHING
  `);
}

type LinkedSubjectRow = {
  readonly subject: string | null;
};

/**
 * Resolve the preferred username for this apply. The client handoff is
 * process-global, so in multi-actor hosts (sims, multi-app product-simulator) one
 * actor's ensure can observe another actor's pending value. The server replay
 * is authoritative and deterministic instead:
 * - anonymous bootstraps, and accounts with no auth record yet, never consume
 *   it (their rows keep the auto name);
 * - when this account has a linked IdP subject (`dev` OAuth subject doubles
 *   as the sim actor username), that subject wins over any passed value (a
 *   foreign pending value is ignored);
 * - otherwise (email/create-account flow, no linked subject) the passed value
 *   stands, preserving legacy behavior.
 *
 * `idp_accounts` lives in the server database only, so the subject lookup
 * runs server-side: locally the lookup fails and the passed value stands
 * (legacy local behavior); sync converges the row to the replayed state.
 */
async function resolveReplayUsername(
  tx: MutationDb,
  profileId: string,
  passed: string | undefined
): Promise<string | undefined> {
  const anon = await tx.query<{
    is_anon: boolean | number | string | null;
  }>(sql`
    SELECT is_anon
    FROM auth_users
    WHERE id = ${profileId}
    LIMIT 1
  `);
  const flag = anon[0]?.is_anon;
  if (flag === true || flag === 1 || flag === '1' || flag === 't') {
    return undefined;
  }
  const rows = await tx.query<LinkedSubjectRow>(sql`
    SELECT a.provider_user_id AS subject
    FROM auth_external_accounts AS e
    INNER JOIN idp_accounts AS a ON a.user_id = e.external_id
    WHERE e.user_id = ${profileId}
    ORDER BY a.provider_user_id ASC
    LIMIT 1
  `);
  const subject = rows[0]?.subject;
  return typeof subject === 'string' && subject.length > 0 ? subject : passed;
}

export const ensureProfileMutation = defineMutation({
  name: 'ensureProfile',
  args: z.object({
    avatarConfig: avatarConfigArgs.optional(),
    username: z.string().optional(),
  }),
  constraintErrors: {
    [USERNAME_NORM_UNIQUE_INDEX]: USERNAME_TAKEN_CONSTRAINT_ERROR,
  },
  async run({ tx, env }, { avatarConfig, username }) {
    await seedProfile(
      tx,
      env.actorId,
      env.now().toISOString(),
      avatarConfig === undefined
        ? serializeDefaultAvatarConfig(env.actorId)
        : avatarConfigJson(avatarConfig)
    );
    await assignUniqueUsernameIfEmpty(tx, env.actorId);
    const preferred =
      env.serverNow === undefined
        ? username
        : await resolveReplayUsername(tx, env.actorId, username);
    await applyPreferredUsernameIfAvailable(tx, env.actorId, preferred);
  },
});
