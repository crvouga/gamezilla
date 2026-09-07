import { useLingui } from '@lingui/solid/macro';
import { AvatarGroup, Box, Clickable, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, For } from 'solid-js';

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

function StackPeek(props: {
  index: number;
  borderRadius: number;
}): JSX.Element {
  const inset = (props.index + 1) * 6;
  const bottom = (props.index + 1) * PEEK_OFFSET;
  return (
    <SpaceCardGradientBox
      sx={{
        position: 'absolute',
        left: inset,
        right: inset,
        bottom,
        height: FRONT_HEIGHT,
        borderRadius: props.borderRadius,
        opacity: 0.55 - props.index * 0.15,
        pointerEvents: 'none',
      }}
    >
      {null}
    </SpaceCardGradientBox>
  );
}

function StackedHostAvatars(props: {
  spaceIds: readonly string[];
}): JSX.Element {
  const visible = createMemo(() => props.spaceIds.slice(0, AVATAR_MAX));
  return (
    <AvatarGroup size={AVATAR_SIZE} maxVisible={AVATAR_MAX} overlap={14}>
      <For each={visible()}>
        {(spaceId) => (
          <SpaceHostAvatar spaceId={spaceId} size={AVATAR_SIZE} vividBackdrop />
        )}
      </For>
    </AvatarGroup>
  );
}

/** Multi-space miniplayer: stacked deck that only opens the picker. */
export function MiniplayerStackedBar(
  props: MiniplayerStackedBarProps
): JSX.Element {
  const { t } = useLingui();
  const count = createMemo(() => props.spaceIds.length);
  const peekCount = createMemo(() =>
    Math.min(MINIPLAYER_STACK_PEEK_COUNT, Math.max(count() - 1, 0))
  );
  const stackPad = createMemo(() => peekCount() * PEEK_OFFSET);
  const peekIndexes = createMemo(() =>
    Array.from({ length: peekCount() }, (_, i) => peekCount() - 1 - i)
  );

  return (
    <Box sx={{ paddingTop: stackPad() }}>
      <Box sx={{ position: 'relative', minHeight: FRONT_HEIGHT }}>
        <For each={peekIndexes()}>
          {(index) => (
            <StackPeek index={index} borderRadius={props.borderRadius} />
          )}
        </For>
        <Clickable
          onClick={props.onPressOpenPicker}
          role="button"
          aria-label={t`Show your live spaces`}
          sx={{
            position: 'relative',
            zIndex: 1,
          }}
        >
          <SpaceCardGradientBox
            sx={{
              borderRadius: props.borderRadius,
              overflow: 'hidden',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              minHeight: FRONT_HEIGHT,
              px: 3,
            }}
          >
            <StackedHostAvatars spaceIds={props.spaceIds} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Text
                variant="bodyBold"
                numberOfLines={1}
                sx={{ color: 'onPrimary' }}
                label={t`${count()} live spaces`}
              />
            </Box>
            <MiniplayerLiveBadge />
          </SpaceCardGradientBox>
        </Clickable>
      </Box>
    </Box>
  );
}
