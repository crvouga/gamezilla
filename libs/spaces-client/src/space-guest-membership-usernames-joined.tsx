import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';
import { For, Show } from 'solid-js';

import { SpaceGuestMembershipUsername } from './space-guest-membership-username';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestMembershipUsernamesJoinedProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
  numberOfLines?: number;
};

const SEPARATOR = ', ';

/**
 * Comma-separated guest usernames for a space. Each name is its own atom;
 * the separator is purely typographic glue between atoms.
 */
export function SpaceGuestMembershipUsernamesJoined(
  props: SpaceGuestMembershipUsernamesJoinedProps
): JSX.Element {
  const membershipIds = useSpaceGuestMembershipIds(props.spaceId);
  return (
    <Show when={membershipIds().length > 0}>
      <p
        class="text"
        classList={{
          textBodyBold: String(props.variant) === 'bodyBold',
          textCaption: String(props.variant) === 'caption',
          textLabel: String(props.variant) === 'label',
          textTitle: String(props.variant) === 'title',
          textSubtitle: String(props.variant) === 'subtitle',
          textHeading: String(props.variant) === 'heading',
          textNavigationTitle: String(props.variant) === 'navigationTitle',
          textLink: String(props.variant) === 'link',
          textMono: String(props.variant) === 'mono',
          [String(props.class)]: true,
        }}
        style={{
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': props.numberOfLines,
          overflow: 'hidden',
        }}
      >
        <For each={membershipIds()}>
          {(mid, index) => (
            <>
              {index() > 0 ? SEPARATOR : null}
              <SpaceGuestMembershipUsername
                membershipId={mid}
                {...(props.variant !== undefined
                  ? { variant: props.variant }
                  : {})}
                {...(props.class !== undefined ? { class: props.class } : {})}
              />
            </>
          )}
        </For>
      </p>
    </Show>
  );
}
