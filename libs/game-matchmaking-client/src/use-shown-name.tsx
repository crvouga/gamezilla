import { useModeration } from '@libs/moderation-client/moderation-context';
import { usernameText } from '@libs/moderation-shared/display';
import { useProfileRow } from '@libs/profile-client/public-use-profile-row';
import { t } from '@lingui/core/macro';

/**
 * A person's name as others may see it now, by profile id: their username,
 * or their stand-in name while that username is no longer allowed.
 */
export function useShownName(profileId: () => string): () => string {
  const moderation = useModeration();
  const profile = useProfileRow(profileId);
  return () =>
    usernameText(moderation(), profile.row()?.username, profileId()) ||
    t`Deleted account`;
}
