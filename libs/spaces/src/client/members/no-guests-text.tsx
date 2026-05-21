import { optionalProps } from '@pkgs/ui/components/optional-props';
import { Text, type SxProps, type TextVariant } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type NoGuestsTextProps = {
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/** Static localized "No guests yet" line. */
export function NoGuestsText({
  variant,
  sx,
  numberOfLines,
}: NoGuestsTextProps): ReactNode {
  return (
    <Text
      {...optionalProps({ variant, sx, numberOfLines })}
      label={<Trans>No guests yet</Trans>}
    />
  );
}
