/** @jsxImportSource solid-js */
/**
 * Inline building blocks for `ActionBar`: icon / avatar items, compact text
 * buttons, and the "More" overflow trigger.
 */

import { useLingui } from '@lingui/solid/macro';
import { For, type JSX, Match, Show, Switch, untrack } from 'solid-js';
import { Box } from '../box';
import { Button } from '../button';
import { IconButton } from '../icon-button';
import { MenuIcon } from '../icons';
import { ActionBarIconButton } from './action-bar-icon-button';
import { ActionBarLabeledControl } from './action-bar-labeled-control';
import {
  type ActionBarAvatarItem,
  type ActionBarItem,
  type ActionBarTextAction,
  isActionBarAvatarItem,
} from './action-bar-logic';

export type ActionBarOverflowTriggerSpec =
  | {
      variant: 'avatar';
      children: JSX.Element;
      label: string;
      dataSet?: Record<string, string> | undefined;
    }
  | undefined;

function ActionBarAvatarItemButton(props: {
  item: ActionBarAvatarItem;
  buttonSize: number;
  showInlineLabel: boolean;
  slotWidth: number;
}): JSX.Element {
  const disabled = (): boolean =>
    props.item.disabled === true || props.item.loading === true;
  const onClick = (): void => {
    // Event handlers have no Solid owner — untrack so `<For>` item accessors
    // do not mint orphaned memos (same pattern as IconButtonFace).
    untrack(() => props.item).onClick();
  };
  return (
    <Show
      when={props.showInlineLabel}
      fallback={
        <IconButton
          variant="avatar"
          size={props.buttonSize}
          label={props.item.label}
          onClick={onClick}
          tooltip="hover"
          disabled={disabled()}
          dataSet={props.item.dataSet}
        >
          {props.item.children}
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
        {props.item.children}
      </ActionBarLabeledControl>
    </Show>
  );
}

export function ActionBarOverflowTrigger(props: {
  buttonSize: number;
  onOpen: () => void;
  setTrigger: (el: HTMLElement) => void;
  open: boolean;
  overflowTrigger?: ActionBarOverflowTriggerSpec;
  showInlineLabels?: boolean | undefined;
  slotWidth?: number | undefined;
  dataSet?: Record<string, string> | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const moreLabel = (): string => t`More`;
  const slotWidth = (): number => props.slotWidth ?? props.buttonSize;
  const iconSize = (): number => Math.round(props.buttonSize * 0.55);
  const menuIcon = (): JSX.Element => (
    <MenuIcon size={iconSize()} color="icon" />
  );
  return (
    <Box
      ref={props.setTrigger}
      dataSet={{ component: 'ActionBarOverflowTrigger', ...props.dataSet }}
    >
      <Switch
        fallback={
          <IconButton
            size={props.buttonSize}
            onClick={props.onOpen}
            label={moreLabel()}
            tooltip="hover"
            aria-haspopup="menu"
            aria-expanded={props.open}
          >
            {menuIcon()}
          </IconButton>
        }
      >
        <Match when={props.overflowTrigger}>
          {(trigger) => (
            <IconButton
              variant="avatar"
              size={props.buttonSize}
              onClick={props.onOpen}
              label={trigger().label}
              aria-label={trigger().label}
              aria-haspopup="menu"
              aria-expanded={props.open}
              tooltip="hover"
              dataSet={trigger().dataSet}
            >
              {trigger().children}
            </IconButton>
          )}
        </Match>
        <Match when={props.showInlineLabels === true}>
          <ActionBarLabeledControl
            caption={moreLabel()}
            label={moreLabel()}
            buttonSize={props.buttonSize}
            slotWidth={slotWidth()}
            onClick={props.onOpen}
          >
            {menuIcon()}
          </ActionBarLabeledControl>
        </Match>
      </Switch>
    </Box>
  );
}

export function ActionBarIconItems(props: {
  items: readonly ActionBarItem[];
  buttonSize: number;
  showInlineLabels?: boolean | undefined;
  slotWidth?: number | undefined;
}): JSX.Element {
  const showInlineLabels = (): boolean => props.showInlineLabels === true;
  const slotWidth = (): number => props.slotWidth ?? props.buttonSize;
  return (
    <For each={props.items}>
      {(item) => (
        <Show
          when={isActionBarAvatarItem(item) ? item : undefined}
          fallback={
            <ActionBarIconButton
              item={isActionBarAvatarItem(item) ? neverIcon() : item}
              buttonSize={props.buttonSize}
              showInlineLabel={showInlineLabels()}
              slotWidth={slotWidth()}
            />
          }
        >
          {(avatar) => (
            <ActionBarAvatarItemButton
              item={avatar()}
              buttonSize={props.buttonSize}
              showInlineLabel={showInlineLabels()}
              slotWidth={slotWidth()}
            />
          )}
        </Show>
      )}
    </For>
  );
}

/** Unreachable: the `Show` above already routed avatar items away. */
function neverIcon(): never {
  throw new Error('ActionBarIconItems: avatar item reached icon branch');
}

export function ActionBarTextItems(props: {
  actions: readonly ActionBarTextAction[];
}): JSX.Element {
  return (
    <For each={props.actions}>
      {(action) => (
        <Button
          title={action.label}
          onClick={action.onClick}
          intent={action.intent ?? 'neutral'}
          size="sm"
          loading={action.loading ?? false}
          disabled={action.disabled ?? false}
        />
      )}
    </For>
  );
}
