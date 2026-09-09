/** @jsxImportSource solid-js */
/**
 * Slots for `BottomActionBar`: tab-style icon+caption action and a contained
 * `Button`.
 */

import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { Box } from '../box';
import { Button } from '../button';
import { Clickable } from '../clickable';
import { Text } from '../text';
import type {
  BottomActionBarActionItem,
  BottomActionBarButtonItem,
} from './bottom-action-bar-types';

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
  const captionColor = (): string => (selected() ? 'tint' : 'textSecondary');
  const ariaLabel = (): string | undefined =>
    props.item['aria-label'] ??
    (typeof props.item.label === 'string' ? props.item.label : undefined);
  return (
    <Clickable
      onClick={() => props.item.onClick()}
      disabled={disabled()}
      aria-label={ariaLabel()}
      aria-pressed={props.item.selected === undefined ? undefined : selected()}
      dataSet={{ component: 'BottomActionBarAction', ...props.item.dataSet }}
      sx={{
        flex: 1,
        borderRadius: 'md',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 0,
        minHeight: 44,
        opacity: disabled() ? 0.5 : 1,
        py: 1,
        gap: 0.5,
      }}
    >
      <Dynamic
        component={props.item.icon}
        size={ICON_SIZE}
        strokeWidth={ICON_STROKE_WIDTH}
        color={iconColor()}
      />
      <Text
        variant="caption"
        numberOfLines={1}
        sx={{
          color: captionColor(),
          textAlign: 'center',
          fontWeight: '700',
          width: '100%',
          fontSize: 13,
          lineHeight: 18,
        }}
        label={props.item.label}
      />
    </Clickable>
  );
}

/** Contained `Button` slot. */
export function BottomActionBarButton(props: {
  item: BottomActionBarButtonItem;
}): JSX.Element {
  return (
    <Box
      dataSet={{ component: 'BottomActionBarButton' }}
      sx={{
        flex: props.item.flex ?? 1,
        alignItems: 'stretch',
        justifyContent: 'center',
        minWidth: 0,
      }}
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
    </Box>
  );
}
