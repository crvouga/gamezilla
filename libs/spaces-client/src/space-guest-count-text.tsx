import { useLingui } from '@lingui/solid/macro';
import type { TextVariant } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestCountTextProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
};

/** Localized "1 guest" / "N guests" line for a space. */
export function SpaceGuestCountText(
  props: SpaceGuestCountTextProps
): JSX.Element {
  const { t } = useLingui();
  const ids = useSpaceGuestMembershipIds(props.spaceId);
  const label = createMemo(() => {
    const count = ids().length;
    return count === 1 ? t`1 guest` : t`${count} guests`;
  });
  return (
    <p
      class="text textBody"
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
    >
      {label()}
    </p>
  );
}
