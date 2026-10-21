/** @jsxImportSource solid-js */
/**
 * `useToast` -- a brief note about something that just happened ("Link
 * copied", "Couldn't save. Try again."), shown at the bottom of the screen
 * and gone on its own. `ToastProvider` (in `./toast-provider`) is mounted
 * once by the app; any screen below it calls `useToast().show(…)`.
 *
 * - `tone`: `neutral` (default), `success`, or `destructive`. A neutral or
 *   success toast is a polite `status`; a destructive one is an `alert`.
 * - `action`: one optional text action ("Undo", "View"). Pressing it runs
 *   the action and dismisses the toast.
 * - The toast leaves after `duration` ms (default 4000), paused while the
 *   pointer is over it or focus is in it. `dismiss(id)` removes it early.
 * - At most three show at once; a fourth pushes out the oldest.
 *
 * A toast never carries the only path to something: a mutation's outcome
 * that must be acknowledged is a `MutationModal`, a lasting condition is a
 * `Notice`.
 *
 * @example
 * ```tsx
 * const toast = useToast();
 * toast.show({ message: t`Link copied` });
 * toast.show({ message: t`Game archived`, action: { label: t`Undo`, onPress: restore } });
 * ```
 */

import { useClock, useTimers } from '@pkgs/clock-client/solid';
import { componentId } from '@pkgs/ui-root-shared/component-id';
import { TOAST_DEFAULT_DURATION_MS } from '@pkgs/ui-root-shared/toast-queue';
import {
  createContext,
  createEffect,
  createSignal,
  type JSX,
  Match,
  onCleanup,
  Show,
  Switch,
  useContext,
} from 'solid-js';
import { CircleAlertIcon, CircleCheckIcon } from './icons';
import { spaced } from './layout-classes';
import styles from './toast.module.css';

export type ToastTone = 'neutral' | 'success' | 'destructive';

export type ToastAction = {
  readonly label: string;
  readonly onPress: () => void;
};

export type ToastOptions = {
  /** The one line that says what happened. */
  readonly message: string;
  /** A quieter second line. */
  readonly description?: string | undefined;
  /** Default `neutral`. */
  readonly tone?: ToastTone | undefined;
  readonly action?: ToastAction | undefined;
  /** How long it stays, in ms. Default 4000; `Infinity` until dismissed. */
  readonly duration?: number | undefined;
  /** Showing the same id again replaces that toast. Default generated. */
  readonly id?: string | undefined;
  /** Rendered as `data-testid`. */
  readonly testId?: string | undefined;
};

export type ToastApi = {
  /** Show a toast; returns its id. */
  readonly show: (options: ToastOptions) => string;
  /** Start removing the toast `id`. */
  readonly dismiss: (id: string) => void;
};

export const ToastContext = createContext<ToastApi | null>(null);

/** The app's toasts. Throws outside a `ToastProvider`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (api === null) throw new Error('useToast: ToastProvider missing');
  return api;
}

export type ToastCardProps = {
  options: ToastOptions;
  leaving: boolean;
  onDismiss: () => void;
};

/** Run `onDismiss` after the duration, paused while `paused()`. */
function useAutoDismiss(props: ToastCardProps, paused: () => boolean): void {
  const clock = useClock();
  const timers = useTimers();
  let remaining = props.options.duration ?? TOAST_DEFAULT_DURATION_MS;
  createEffect(() => {
    if (paused() || props.leaving || !Number.isFinite(remaining)) return;
    const started = clock.now();
    const handle = timers.setTimeout(() => props.onDismiss(), remaining);
    onCleanup(() => {
      timers.clearTimeout(handle);
      remaining = Math.max(0, remaining - (clock.now() - started));
    });
  });
}

function ToastGlyph(props: { tone: ToastTone }): JSX.Element {
  return (
    <Switch>
      <Match when={props.tone === 'success'}>
        <CircleCheckIcon size={20} color="success" />
      </Match>
      <Match when={props.tone === 'destructive'}>
        <CircleAlertIcon size={20} color="destructive" />
      </Match>
    </Switch>
  );
}

function ToastActionButton(props: {
  action: ToastAction;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      class="clickable clickableOpacity shrink-0 justify-center rounded-sm min-h-ui-control-sm px-ui-xs"
      data-component={componentId('ToastAction')}
      onClick={() => {
        props.action.onPress();
        props.onDismiss();
      }}
    >
      <span class="text textBodyBold text-tint">{props.action.label}</span>
    </button>
  );
}

/** One toast: glyph, message, optional description and action. */
export function ToastCard(props: ToastCardProps): JSX.Element {
  const [hovered, setHovered] = createSignal(false);
  const [focused, setFocused] = createSignal(false);
  useAutoDismiss(props, () => hovered() || focused());
  const tone = (): ToastTone => props.options.tone ?? 'neutral';
  return (
    <div
      class={spaced([
        'box flex-row items-center gap-ui-md w-full max-w-ui-form px-ui-lg py-ui-md rounded-card border border-border bg-surface-overlay shadow-float',
        styles['toast'],
        props.leaving ? styles['leaving'] : undefined,
      ])}
      data-testid={props.options.testId}
      data-component={componentId('Toast')}
      data-tone={tone()}
      data-state={props.leaving ? 'leaving' : 'open'}
      role={tone() === 'destructive' ? 'alert' : 'status'}
      aria-atomic="true"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusIn={() => setFocused(true)}
      onFocusOut={() => setFocused(false)}
    >
      <ToastGlyph tone={tone()} />
      <div class="box flex-1 gap-ui-none">
        <p class="text textBodyBold">{props.options.message}</p>
        <Show when={props.options.description} keyed>
          {(description) => <p class="text textCaption">{description}</p>}
        </Show>
      </div>
      <Show when={props.options.action} keyed>
        {(action) => (
          <ToastActionButton action={action} onDismiss={props.onDismiss} />
        )}
      </Show>
    </div>
  );
}
