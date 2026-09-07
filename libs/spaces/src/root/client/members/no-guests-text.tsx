import { Trans } from '@lingui/solid/macro';
import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type NoGuestsTextProps = {
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/** Static localized "No guests yet" line. */
export function NoGuestsText(props: NoGuestsTextProps): JSX.Element {
  return (
    <Text
      variant={props.variant}
      sx={props.sx}
      numberOfLines={props.numberOfLines}
      label={<Trans>No guests yet</Trans>}
    />
  );
}
