/** @jsxImportSource @solidjs/web */
/**
 * Slots for `BottomActionBar`: tab-style icon+caption action and a contained
 * `Button`.
 */

import { ariaBoolean } from '@pkgs/ui-root-shared-ts/aria-boolean';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { dynamic, type JSX } from '@solidjs/web';
import { Button as SdkButton } from '@ui-sdk/solid/button';
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
  const ItemIcon = dynamic(() => props.item.icon);
  // An enabled action reads in full ink; a disabled one steps down to the
  // secondary ink, never faded, so it still reads at text contrast.
  const iconColor = (): string => {
    if (selected()) return 'tint';
    return disabled() ? 'icon' : 'text';
  };
  const ariaLabel = (): string | undefined =>
    props.item['aria-label'] ??
    (typeof props.item.label === 'string' ? props.item.label : undefined);
  return (
    <SdkButton
      class="clickable clickableTint flex-1 rounded-control items-center justify-center min-w-0 min-h-11 py-1 gap-1"
      {...dataAttrs({
        component: 'BottomActionBarAction',
        ...props.item.dataSet,
      })}
      type="button"
      onClick={() => props.item.onClick()}
      disabled={disabled()}
      aria-label={ariaLabel()}
      aria-pressed={ariaBoolean(props.item.selected)}
    >
      <ItemIcon
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        color={iconColor()}
      />
      <p
        class={[
          'text textFootnote line-clamp-1 text-center w-full',
          {
            'text-tint': selected(),
            'text-text': !selected() && !disabled(),
            'text-text-secondary': !selected() && disabled(),
          },
        ]}
      >
        {props.item.label}
      </p>
    </SdkButton>
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
