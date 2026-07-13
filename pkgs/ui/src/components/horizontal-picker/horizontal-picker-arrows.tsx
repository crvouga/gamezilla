import type { ReactNode } from 'react';
import { useLingui } from '@lingui/react/macro';
import { IconButton } from '../icon-button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

const ARROW_SIZE = 36;
const ICON_SIZE = 18;

export type HorizontalPickerArrowProps = {
  direction: 'prev' | 'next';
  disabled: boolean;
  onPress: () => void;
};

export function HorizontalPickerArrow({
  direction,
  disabled,
  onPress,
}: HorizontalPickerArrowProps): ReactNode {
  const { t } = useLingui();
  const isPrev = direction === 'prev';
  return (
    <IconButton
      size={ARROW_SIZE}
      background="surface"
      onPress={onPress}
      disabled={disabled}
      label={isPrev ? t`Previous` : t`Next`}
    >
      {isPrev ? (
        <ChevronLeftIcon size={ICON_SIZE} />
      ) : (
        <ChevronRightIcon size={ICON_SIZE} />
      )}
    </IconButton>
  );
}
