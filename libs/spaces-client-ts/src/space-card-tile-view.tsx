import { Handles } from '@libs/test-ids-shared-ts/handles';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { Index, Show } from 'solid-js';
import {
  SpaceCardActionLabel,
  type SpaceCardData,
  SpaceGuestsPhrase,
  SpaceHostPhrase,
  spaceCardAction,
  spaceCardTestId,
  useSpaceCardLabel,
} from './space-card-view';
import { SpacePersonAvatar } from './space-person-view';

const HOST_AVATAR_SIZE = 44;
const GUEST_AVATAR_SIZE = 24;
const GUEST_AVATAR_MAX_VISIBLE = 5;

/** The faces of who else is in the space, then who they are in words. */
function SpaceTileGuests(props: {
  readonly space: SpaceCardData;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="sm">
      <Show when={props.space.guests.length > 0}>
        <AvatarGroup
          size={GUEST_AVATAR_SIZE}
          maxVisible={GUEST_AVATAR_MAX_VISIBLE}
          ringColor="surface"
        >
          <Index each={props.space.guests}>
            {(guest) => (
              <SpacePersonAvatar person={guest()} size={GUEST_AVATAR_SIZE} />
            )}
          </Index>
        </AvatarGroup>
      </Show>
      <StackVertical grow shrink>
        <P variant="caption" lines={1}>
          <SpaceGuestsPhrase guests={props.space.guests} />
        </P>
      </StackVertical>
    </StackHorizontal>
  );
}

/**
 * A space as a desktop card in the lobby's grid: the row's anatomy (host
 * face, name with what pressing it does, who hosts it) with room for the
 * faces of who else is in it. The whole card is the control.
 */
export function SpaceCardTileView(props: {
  readonly space: SpaceCardData;
  readonly onOpen: () => void;
}): JSX.Element {
  const label = useSpaceCardLabel(() => props.space);
  return (
    <Surface tone="surface" radius="card" border grow>
      <Pressable
        grow
        radius="card"
        testId={spaceCardTestId(props.space)}
        onPress={() => props.onOpen()}
        aria-label={label()}
      >
        <StackVertical
          padding="lg"
          gap="md"
          testId={Handles.spaceLobbyCard(props.space.spaceId)}
        >
          <StackHorizontal gap="md" align="center">
            <SpacePersonAvatar
              person={props.space.host}
              size={HOST_AVATAR_SIZE}
              vividBackdrop
            />
            <StackVertical grow shrink gap="xs">
              <Text variant="rowTitle" lines={1}>
                {props.space.title}
              </Text>
              <P variant="caption" lines={1}>
                <SpaceHostPhrase space={props.space} />
              </P>
            </StackVertical>
            <SpaceCardActionLabel action={spaceCardAction(props.space)} />
          </StackHorizontal>
          <SpaceTileGuests space={props.space} />
        </StackVertical>
      </Pressable>
    </Surface>
  );
}
