import { resolveReplayUsername } from '@libs/auth-shared-ts/replay-username';
import { contentRulesIn } from '@libs/moderation-shared-ts/mutation-content';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';
import { applyPreferredUsernameIfAvailable } from './apply-preferred-username';
import { assignUniqueUsernameIfEmpty } from './assign-unique-username';
import { serializeDefaultAvatarConfig } from './avatar-config';
import { avatarConfigArg, avatarConfigJson } from './avatar-mutation-argument';
import { seedProfile } from './seed-profile';
import {
  USERNAME_NORM_UNIQUE_INDEX,
  USERNAME_TAKEN_CONSTRAINT_ERROR,
} from './username-column';

export const ensureProfileMutation = defineMutation({
  name: 'ensureProfile',
  args: z.object({
    avatarConfig: avatarConfigArg.optional(),
    username: z.string().optional(),
  }),
  constraintErrors: {
    [USERNAME_NORM_UNIQUE_INDEX]: USERNAME_TAKEN_CONSTRAINT_ERROR,
  },
  async run({ tx, env }, { avatarConfig, username }) {
    await seedProfile(
      tx,
      env,
      avatarConfig === undefined
        ? serializeDefaultAvatarConfig(env.actorId)
        : avatarConfigJson(avatarConfig)
    );
    await assignUniqueUsernameIfEmpty(tx, env.actorId, contentRulesIn(env));
    const preferred =
      env.serverNow === undefined
        ? username
        : await resolveReplayUsername(tx, env.actorId, username);
    await applyPreferredUsernameIfAvailable(
      tx,
      env.actorId,
      preferred,
      contentRulesIn(env)
    );
  },
});
