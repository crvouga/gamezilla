/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { For, type JSX, Show } from 'solid-js';
import { Button } from '../button/index';
import { createScreenSlot } from '../screen-slot';

/** One game action. */
export type GameActionItem = {
  /** Stable within the bar. */
  id: string;
  label: JSX.Element;
  /** Shipped as `data-testid`. */
  testId: string;
  onPress: () => void;
  disabled?: boolean | undefined;
  /** The one next step: the blue fill. */
  emphasis?: 'primary' | undefined;
  /** A tool toggle: whether it is the chosen one. */
  pressed?: boolean | undefined;
};

export type GameActionBarProps = {
  items: readonly GameActionItem[];
  /** The frame's own commands, after the game's actions. */
  children?: JSX.Element | undefined;
  /** Names the group of actions. */
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

function ActionButton(props: { item: GameActionItem }): JSX.Element {
  const primary = (): boolean => props.item.emphasis === 'primary';
  return (
    <Button
      title={props.item.label}
      intent={primary() ? 'primary' : 'neutral'}
      variant={primary() ? 'solid' : 'outline'}
      disabled={props.item.disabled}
      aria-pressed={props.item.pressed}
      onClick={() => props.item.onPress()}
      dataSet={{ testid: props.item.testId, action: props.item.id }}
    />
  );
}

/**
 * `GameActionBar` -- what a person can do in the game right now, as one
 * wrapping row of buttons: the game's own actions (`items`) and then the
 * frame's commands (`children`: resign, offer a draw). Secondary (outlined)
 * by default; `emphasis: 'primary'` for the one next step; `pressed` makes an
 * item a tool toggle (`aria-pressed`), so the chosen tool is announced, not
 * only colored. No margins of its own, so it sits in a sticky footer as well
 * as under the board; with nothing to show it draws nothing.
 *
 * @example
 * ```tsx
 * <GameActionBar
 *   aria-label="Actions"
 *   items={[
 *     { id: 'move', label: 'Move', testId: 'game-mode-move', onPress: move, pressed: true },
 *     { id: 'pass', label: 'Pass', testId: 'game-pass', onPress: pass, emphasis: 'primary' },
 *   ]}
 * >
 *   <Button title="Resign" intent="neutral" variant="outline" onClick={resign} />
 * </GameActionBar>
 * ```
 */
export function GameActionBar(props: GameActionBarProps): JSX.Element {
  const commands = createScreenSlot(() => props.children);
  return (
    <Show when={props.items.length > 0 || commands.present()}>
      <div
        class="box flex-row flex-wrap items-center gap-2 w-full min-w-0"
        role="group"
        aria-label={props['aria-label']}
        {...dataAttrs({ component: 'GameActionBar', ...props.dataSet })}
      >
        <For each={props.items}>{(item) => <ActionButton item={item} />}</For>
        <Show when={commands.present()}>{commands.content()}</Show>
      </div>
    </Show>
  );
}
