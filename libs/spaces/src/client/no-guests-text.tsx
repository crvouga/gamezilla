import { optionalProps } from '@gamezilla/client/ui/optional-props';
import { Text, type SxProps, type TextVariant } from '@gamezilla/ui';
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
