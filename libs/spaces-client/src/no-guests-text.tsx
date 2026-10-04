import { Trans } from '@lingui/solid/macro';
import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';

export type NoGuestsTextProps = {
  variant?: TextVariant;
  class?: string;
  numberOfLines?: number;
};

/** Static localized "No guests yet" line. */
export function NoGuestsText(props: NoGuestsTextProps): JSX.Element {
  return (
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
      <Trans>No guests yet</Trans>
    </p>
  );
}
