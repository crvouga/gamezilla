import { Trans } from '@lingui/solid/macro';
import { Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type NoGuestsTextProps = {
  variant?: TextVariant;
  class?: string;
  numberOfLines?: number;
};

/** Static localized "No guests yet" line. */
export function NoGuestsText(props: NoGuestsTextProps): JSX.Element {
  return (
    <Text
      variant={props.variant}
      class={props.class}
      numberOfLines={props.numberOfLines}
    >
      <Trans>No guests yet</Trans>
    </Text>
  );
}
