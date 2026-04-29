import { PrincipalAvatar } from '@gamezilla/client/profile/principal-avatar';
import { Box, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import type { SpaceMemberRow } from './types';

export type SpaceMemberListProps = {
  members: SpaceMemberRow[];
};

export function SpaceMemberList({ members }: SpaceMemberListProps) {
  return (
    <Box sx={{ gap: 2 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label={<Trans>People here</Trans>}
      />
      <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {members.map((m) => (
          <Box key={m.principalId} sx={{ alignItems: 'center', gap: 1 }}>
            <PrincipalAvatar
              avatarConfig={m.avatarConfig}
              principalId={m.principalId}
              size={40}
            />
            <Text variant="caption" numberOfLines={1} label={m.displayName} />
            {m.role === 'host' ? (
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label={<Trans>Host</Trans>}
              />
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
