import { contentRulesIn } from '@libs/moderation-shared-ts/mutation-content';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type {
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';

import { generateRandomUsername } from './username-generator';

const PROFILE_SEED_USERNAME_ATTEMPTS = 8;

export async function seedProfile(
  tx: MutationDb,
  env: MutationEnv,
  avatarConfig: string
): Promise<void> {
  const profileId = env.actorId;
  const now = env.now().toISOString();
  const rules = contentRulesIn(env);
  let username = '';
  for (
    let attempt = 0;
    attempt < PROFILE_SEED_USERNAME_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = generateRandomUsername(
      rules,
      `${profileId}:seed:${attempt}`
    );
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
