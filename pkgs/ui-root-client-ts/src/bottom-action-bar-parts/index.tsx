/** @jsxImportSource solid-js */
/**
 * Slots for `BottomActionBar`: tab-style icon+caption action and a contained
 * `Button`.
 */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  BottomActionBarActionItem,
  BottomActionBarButtonItem,
} from '../bottom-action-bar-types';
import { Button } from '../button/index';

const ICON_SIZE = 24;
const ICON_STROKE_WIDTH = 2.75;

/** Tab-style control: icon above short label, no filled chip. */
export function BottomActionBarAction(props: {
  item: BottomActionBarActionItem;
}): JSX.Element {
  const disabled = (): boolean => props.item.disabled === true;
  const selected = (): boolean => props.item.selected === true;
  const iconColor = (): string =>
    selected() ? 'tint' : disabled() ? 'textSecondary' : 'icon';
  const ariaLabel = (): string | undefined =>
    props.item['aria-label'] ??
    (typeof props.item.label === 'string' ? props.item.label : undefined);
  return (
    <button
      class="clickable clickableTint flex-1 rounded-control items-center justify-center min-w-0 min-h-11 py-1 gap-1"
      classList={{ 'opacity-disabled': disabled() }}
      {...dataAttrs({
        component: 'BottomActionBarAction',
        ...props.item.dataSet,
      })}
      type="button"
      onClick={() => props.item.onClick()}
      disabled={disabled()}
      aria-label={ariaLabel()}
      aria-pressed={props.item.selected === undefined ? undefined : selected()}
    >
      <Dynamic
        component={props.item.icon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        color={iconColor()}
      />
      <p
        class="text textFootnote line-clamp-1 text-center w-full"
        classList={{
          'text-tint': selected(),
          'text-text-secondary': !selected(),
        }}
      >
        {props.item.label}
      </p>
    </button>
  );
}

/** Contained `Button` slot. */
export function BottomActionBarButton(props: {
  item: BottomActionBarButtonItem;
}): JSX.Element {
  return (
    <div
      class="box items-stretch justify-center min-w-0"
      data-component="BottomActionBarButton"
      style={{ flex: props.item.flex ?? 1 }}
    >
      <Button
        title={props.item.title}
        onClick={props.item.onClick}
        intent={props.item.intent ?? 'primary'}
        variant={props.item.variant ?? 'solid'}
        flex={1}
        disabled={props.item.disabled}
        loading={props.item.loading}
        startIcon={props.item.startIcon}
        endIcon={props.item.endIcon}
        // testids must live on the clickable control — driver `tap` targets
        // the matched node, and a wrapper Box would swallow the click.
        dataSet={props.item.dataSet}
      />
    </div>
  );
}
