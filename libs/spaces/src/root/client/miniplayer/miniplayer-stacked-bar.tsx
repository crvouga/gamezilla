import { useLingui } from '@lingui/react/macro';
import { AvatarGroup, Box, Pressable, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { SpaceCardGradientBox } from '../card/space-card-gradient';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MINIPLAYER_STACK_PEEK_COUNT } from './space-miniplayer-layout';

export type MiniplayerStackedBarProps = {
  spaceIds: readonly string[];
  /** Corner radius — `0` for the compact full-bleed strip, card radius on wide. */
  borderRadius: number;
  onPressOpenPicker: () => void;
};

const FRONT_HEIGHT = 72;
const PEEK_OFFSET = 5;
const AVATAR_SIZE = 40;
const AVATAR_MAX = 3;

function StackPeek({
  index,
  borderRadius,
}: {
  index: number;
  borderRadius: number;
}): ReactNode {
  const inset = (index + 1) * 6;
  const bottom = (index + 1) * PEEK_OFFSET;
  return (
    <SpaceCardGradientBox
      sx={{
        position: 'absolute',
        left: inset,
        right: inset,
        bottom,
        height: FRONT_HEIGHT,
        borderRadius,
        opacity: 0.55 - index * 0.15,
        pointerEvents: 'none',
      }}
    >
      {null}
    </SpaceCardGradientBox>
  );
}

function StackedHostAvatars({
  spaceIds,
}: {
  spaceIds: readonly string[];
}): ReactNode {
  const visible = spaceIds.slice(0, AVATAR_MAX);
  return (
    <AvatarGroup size={AVATAR_SIZE} maxVisible={AVATAR_MAX} overlap={14}>
      {visible.map((spaceId) => (
        <SpaceHostAvatar
          key={spaceId}
          spaceId={spaceId}
          size={AVATAR_SIZE}
          vividBackdrop
        />
      ))}
    </AvatarGroup>
  );
}

/** Multi-space miniplayer: stacked deck that only opens the picker. */
export function MiniplayerStackedBar({
  spaceIds,
  borderRadius,
  onPressOpenPicker,
}: MiniplayerStackedBarProps): ReactNode {
  const { t } = useLingui();
  const count = spaceIds.length;
  const peekCount = Math.min(
    MINIPLAYER_STACK_PEEK_COUNT,
    Math.max(count - 1, 0)
  );
  const stackPad = peekCount * PEEK_OFFSET;

  return (
    <Box sx={{ paddingTop: stackPad }}>
      <Box sx={{ position: 'relative', minHeight: FRONT_HEIGHT }}>
        {Array.from({ length: peekCount }, (_, i) => (
          <StackPeek
            key={i}
            index={peekCount - 1 - i}
            borderRadius={borderRadius}
          />
        ))}
        <Pressable
          onPress={onPressOpenPicker}
          accessibilityRole="button"
          accessibilityLabel={t`Show your live spaces`}
          sx={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <SpaceCardGradientBox
            sx={{
              borderRadius,
              overflow: 'hidden',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              minHeight: FRONT_HEIGHT,
              px: 3,
            }}
          >
            <StackedHostAvatars spaceIds={spaceIds} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Text
                variant="bodyBold"
                numberOfLines={1}
                sx={{ color: 'onPrimary' }}
                label={t`${count} live spaces`}
              />
            </Box>
            <MiniplayerLiveBadge />
          </SpaceCardGradientBox>
        </Pressable>
      </Box>
    </Box>
  );
}
