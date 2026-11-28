import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';

import { parseAvatarConfig, serializeAvatarConfig } from './avatar-config';

export const avatarConfigArg = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

export function avatarConfigJson(
  value: z.infer<typeof avatarConfigArg>
): string {
  const avatarConfig = parseAvatarConfig(value);
  if (avatarConfig === null) {
    throw new MutationError(
      'INVALID_AVATAR_CONFIG',
      'Avatar configuration is invalid.'
    );
  }
  return serializeAvatarConfig(avatarConfig);
}
