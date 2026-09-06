/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { type JSX, Show } from 'solid-js';
import { IconButton } from '../icon-button';
import { ChevronLeftIcon, ChevronRightIcon } from '../icons';

const ARROW_SIZE = 36;
const ICON_SIZE = 18;

export type HorizontalPickerArrowProps = {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
};

export function HorizontalPickerArrow(
  props: HorizontalPickerArrowProps
): JSX.Element {
  const { t } = useLingui();
  const isPrev = (): boolean => props.direction === 'prev';
  return (
    <IconButton
      size={ARROW_SIZE}
      background="surface"
      onClick={() => props.onClick()}
      disabled={props.disabled}
      label={isPrev() ? t`Previous` : t`Next`}
      tooltip="none"
      dataSet={{
        component: 'HorizontalPickerArrow',
        direction: props.direction,
      }}
    >
      <Show when={isPrev()} fallback={<ChevronRightIcon size={ICON_SIZE} />}>
        <ChevronLeftIcon size={ICON_SIZE} />
      </Show>
    </IconButton>
  );
}
