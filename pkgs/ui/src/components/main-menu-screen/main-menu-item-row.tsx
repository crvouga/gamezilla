/** @jsxImportSource solid-js */
/**
 * One card row of `MainMenuScreen`: title, optional caption, and a trailing
 * chevron / selection check. Interactive rows are `Clickable`s.
 */

import { createMemo, type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { useThemeTokens } from '../../theme';
import { Box } from '../box';
import { Clickable } from '../clickable';
import { GradientBox } from '../gradient-box';
import { ChevronRightIcon, CircleCheckIcon } from '../icons';
import { Text } from '../text';
import { resolveNeutralGradient } from './main-menu-gradient';

export type MainMenuItem = {
  /** Stable id for list keys. */
  key: string;
  title: JSX.Element;
  caption?: JSX.Element | undefined;
  /** Overrides the default trailing affordance (chevron / selection check). */
  trailing?: JSX.Element | undefined;
  selected?: boolean | undefined;
  disabled?: boolean | undefined;
  onClick?: (() => void) | undefined;
  /** DOM `data-*` identifiers for the row. */
  dataSet?: ComponentDataSet | undefined;
};

const MENU_ITEM_MIN_HEIGHT = 84;

function DefaultTrailing(props: { selected: boolean }): JSX.Element {
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <Show when={props.selected}>
        <CircleCheckIcon size={20} color="tint" />
      </Show>
      <ChevronRightIcon size={20} color="icon" />
    </Box>
  );
}

function ItemTrailing(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  return (
    <Show
      when={props.item.trailing !== undefined}
      fallback={
        <Show when={props.interactive}>
          <DefaultTrailing selected={props.item.selected === true} />
        </Show>
      }
    >
      {props.item.trailing}
    </Show>
  );
}

function ItemBody(props: {
  item: MainMenuItem;
  interactive: boolean;
}): JSX.Element {
  const tokens = useThemeTokens();
  const gradient = createMemo(() =>
    resolveNeutralGradient(tokens.palette().surfaceElevated)
  );
  const disabled = (): boolean => props.item.disabled === true;
  const captionInTrailing = (): boolean =>
    disabled() && props.item.caption !== undefined;
  return (
    <Box
      sx={{
        py: 4,
        px: 4,
        minHeight: MENU_ITEM_MIN_HEIGHT,
        justifyContent: 'center',
        opacity: disabled() ? 0.5 : 1,
        borderRadius: 'lg',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        backgroundColor: 'surfaceElevated',
        overflow: 'hidden',
      }}
    >
      <GradientBox
        aria-hidden="true"
        colors={[gradient().top, gradient().bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, gap: 1, alignItems: 'flex-start' }}>
          <Text variant="bodyBold" label={props.item.title} />
          <Show when={props.item.caption !== undefined && !captionInTrailing()}>
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={props.item.caption}
            />
          </Show>
        </Box>
        <Show
          when={captionInTrailing()}
          fallback={
            <ItemTrailing item={props.item} interactive={props.interactive} />
          }
        >
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', fontStyle: 'italic' }}
            label={props.item.caption}
          />
        </Show>
      </Box>
    </Box>
  );
}

export function MainMenuItemRow(props: { item: MainMenuItem }): JSX.Element {
  const interactive = (): boolean =>
    props.item.onClick !== undefined && props.item.disabled !== true;
  return (
    <Show
      when={props.item.onClick}
      fallback={
        <Box dataSet={{ component: 'MainMenuItem', ...props.item.dataSet }}>
          <ItemBody item={props.item} interactive={false} />
        </Box>
      }
    >
      {(onClick) => (
        <Clickable
          onClick={() => onClick()()}
          disabled={props.item.disabled === true}
          aria-pressed={props.item.selected === true ? true : undefined}
          sx={{ borderRadius: 'lg', alignItems: 'stretch' }}
          dataSet={{ component: 'MainMenuItem', ...props.item.dataSet }}
        >
          <ItemBody item={props.item} interactive={interactive()} />
        </Clickable>
      )}
    </Show>
  );
}
