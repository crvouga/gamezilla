import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
} from 'solid-js';
import { Button } from '../button/index';
import { GameActionBar, type GameActionItem } from '../game-action-bar/index';
import styles from './word-tile-workbench.module.css';

/** Word editing actions and full-width feedback, with clearance for session history. */
export function WordTileWorkbench(props: {
  children: JSX.Element;
}): JSX.Element {
  return (
    <div
      class={styles['workbench']}
      {...dataAttrs({ component: 'WordTileWorkbench' })}
    >
      {props.children}
    </div>
  );
}

/** Primary word action stays exposed; secondary tools use a named disclosure. */
export function WordTileActions(props: {
  items: readonly GameActionItem[];
  label: string;
  moreLabel: string;
  testId: string;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;
  const primary = () =>
    props.items.filter(
      (item) => item.emphasis === 'primary' || item.id === 'exchange-cancel'
    );
  const secondary = () =>
    props.items.filter(
      (item) => item.emphasis !== 'primary' && item.id !== 'exchange-cancel'
    );
  const close = (): void => {
    setOpen(false);
    root
      ?.querySelector<HTMLButtonElement>('[aria-expanded]')
      ?.focus({ preventScroll: true });
  };
  createEffect(() => {
    if (open()) onCleanup(pushEscapeDismissHandler(close));
  });
  return (
    <Show when={props.items.length > 0}>
      <div ref={root} {...dataAttrs({ component: 'WordTileActions' })}>
        <GameActionBar items={primary()} aria-label={props.label}>
          <Show when={secondary().length > 0}>
            <Button
              title={props.moreLabel}
              intent="neutral"
              variant="outline"
              aria-expanded={open()}
              dataSet={{ testid: `${props.testId}-more` }}
              onClick={() => setOpen((value) => !value)}
            />
          </Show>
        </GameActionBar>
        <Show when={open()}>
          <div
            class={styles['secondary']}
            role="group"
            aria-label={props.moreLabel}
          >
            <GameActionBar
              items={secondary().map((item) => ({
                ...item,
                onPress: () => {
                  item.onPress();
                  close();
                },
              }))}
            />
          </div>
        </Show>
      </div>
    </Show>
  );
}
