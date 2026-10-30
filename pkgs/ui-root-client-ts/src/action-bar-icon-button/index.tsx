/** @jsxImportSource solid-js */

import { useTimers } from '@pkgs/clock-client-ts/solid';
import { createSignal, type JSX, onCleanup, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { ActionBarLabeledControl } from '../action-bar-labeled-control/index';
import type { ActionBarIconItem } from '../action-bar-logic';
import { actionBarGlyphSize } from '../action-bar-logic';
import type { IconComponent } from '../create-icon/index';
import { IconButton } from '../icon-button/index';
import { CircleCheckIcon } from '../icons';

export const ACTION_BAR_FEEDBACK_RESET_MS = 2000;

type IconPresentation = {
  tooltipLabel: JSX.Element;
  icon: IconComponent;
  color: string;
};

export function resolveIconPresentation(
  item: ActionBarIconItem,
  success: boolean
): IconPresentation {
  const feedback = item.pressFeedback;
  if (success && feedback !== undefined) {
    return {
      tooltipLabel: feedback.successLabel,
      icon: feedback.successIcon ?? CircleCheckIcon,
      color: 'success',
    };
  }
  return { tooltipLabel: item.label, icon: item.icon, color: 'icon' };
}

export type ActionBarIconButtonProps = {
  item: ActionBarIconItem;
  buttonSize: number;
  showInlineLabel: boolean;
  slotWidth: number;
};

/**
 * Inline icon item for `ActionBar`, with optional click feedback: the glyph
 * swaps to `pressFeedback.successIcon` (default check) in the success color
 * and the tooltip flashes `successLabel` until `resetMs` elapses.
 */
export function ActionBarIconButton(
  props: ActionBarIconButtonProps
): JSX.Element {
  const timers = useTimers();
  const [success, setSuccess] = createSignal(false);
  let resetHandle: unknown = null;
  const clearReset = (): void => {
    if (resetHandle !== null) timers.clearTimeout(resetHandle);
    resetHandle = null;
  };
  onCleanup(clearReset);

  const disabled = (): boolean =>
    props.item.disabled === true || props.item.loading === true;
  const presentation = (): IconPresentation =>
    resolveIconPresentation(props.item, success());

  const onClick = (): void => {
    const item = props.item;
    if (item.disabled === true || item.loading === true) return;
    item.onClick();
    const feedback = item.pressFeedback;
    if (feedback === undefined) return;
    setSuccess(true);
    clearReset();
    resetHandle = timers.setTimeout(
      () => setSuccess(false),
      feedback.resetMs ?? ACTION_BAR_FEEDBACK_RESET_MS
    );
  };

  const glyph = (): JSX.Element => (
    <div class="box items-center justify-center">
      <Dynamic
        component={presentation().icon}
        size={actionBarGlyphSize(props.buttonSize)}
        color={presentation().color}
      />
    </div>
  );

  return (
    <Show
      when={props.showInlineLabel}
      fallback={
        <IconButton
          size={props.buttonSize}
          label={presentation().tooltipLabel}
          onClick={onClick}
          tooltip="hover"
          flashTooltipOnClick={props.item.pressFeedback !== undefined}
          disabled={disabled()}
          dataSet={props.item.dataSet}
        >
          {glyph()}
        </IconButton>
      }
    >
      <ActionBarLabeledControl
        caption={props.item.shortLabel ?? props.item.label}
        label={props.item.label}
        buttonSize={props.buttonSize}
        slotWidth={props.slotWidth}
        disabled={disabled()}
        onClick={onClick}
        dataSet={props.item.dataSet}
      >
        {glyph()}
      </ActionBarLabeledControl>
    </Show>
  );
}
