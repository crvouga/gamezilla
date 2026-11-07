import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { pushEscapeDismissHandler } from '@pkgs/ui-root-shared-ts/escape-dismiss-stack';
import {
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
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

/** Disjoint full-sized blank-letter choices; typing a letter chooses it directly. */
export function WordTileLetterChoices(props: {
  label: string;
  onLetter?: (letter: string) => void;
  children: JSX.Element;
}): JSX.Element {
  let root: HTMLDivElement | undefined;
  const chooseKey = (event: KeyboardEvent): void => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !/^[a-z]$/i.test(event.key)
    )
      return;
    event.preventDefault();
    props.onLetter?.(event.key.toUpperCase());
  };
  onMount(() => {
    const previous = document.activeElement;
    const buttons = root?.querySelectorAll('button');
    for (const button of buttons ?? [])
      button.addEventListener('keydown', chooseKey);
    onCleanup(() => {
      for (const button of buttons ?? [])
        button.removeEventListener('keydown', chooseKey);
    });
    root
      ?.querySelector<HTMLButtonElement>('button')
      ?.focus({ preventScroll: true });
    onCleanup(() => {
      if (
        root?.contains(document.activeElement) &&
        previous instanceof HTMLElement &&
        previous.isConnected
      )
        previous.focus({ preventScroll: true });
    });
  });
  return (
    <div
      ref={root}
      class={styles['letters']}
      role="group"
      aria-label={props.label}
      {...dataAttrs({ component: 'WordTileLetterChoices' })}
    >
      {props.children}
    </div>
  );
}

export { WordTileBlankContext } from './word-tile-blank-context';
