import { Avatar, Box, Text } from '@gamezilla/shared/ui';

import type { SpaceMemberRow } from './types';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`;
  }
  return name.slice(0, 2) || '?';
}

export type SpaceMemberListProps = {
  members: SpaceMemberRow[];
};

export function SpaceMemberList({ members }: SpaceMemberListProps) {
  return (
    <Box sx={{ gap: 2 }}>
      <Text
        variant="label"
        sx={{ color: 'textSecondary' }}
        label="People here"
      />
      <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {members.map((m) => (
          <Box key={m.principalId} sx={{ alignItems: 'center', gap: 1 }}>
            <Avatar initials={initialsFromName(m.displayName)} size={40} />
            <Text variant="caption" numberOfLines={1} label={m.displayName} />
            {m.role === 'host' ? (
              <Text
                variant="caption"
                sx={{ color: 'textSecondary' }}
                label="Host"
              />
            ) : null}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
