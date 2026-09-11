/** @jsxImportSource solid-js */
/**
 * `Motion` -- a `Box` whose styles animate with a CSS transition.
 *
 * Replaces JS-driven animated views: set reactive `style` / `class` (opacity,
 * transform, colors, sizes) and the browser interpolates on the compositor.
 * Pass `present={false}` to play `exitStyle` and unmount after the transition.
 * Unmount timing uses the injected `Timers` (via `ClockProvider`) so the
 * exit is deterministic under simulation.
 */

import { useTimers } from '@pkgs/clock/solid';
import type { Timers } from '@pkgs/clock/types';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  Show,
  splitProps,
} from 'solid-js';
import { dataAttrs } from '../../component-id';
import { type DurationKey, type EasingKey, useThemeTokens } from '../../theme';
import type { DivBoxProps } from '../box';

export type MotionProps = DivBoxProps & {
  /** Duration token. Defaults to `normal`. */
  duration?: DurationKey | undefined;
  /** Easing token. Defaults to `standard`. */
  easing?: EasingKey | undefined;
  /** CSS `transition-property`. Defaults to `all`. */
  property?: string | undefined;
  /**
   * Presence: when it flips to `false` the box plays `exitStyle` and unmounts
   * after the transition; when `true` it mounts and plays from `enterStyle`.
   * Omit for an always-mounted transitioning box (no enter/exit — only the
   * reactive `style` / `class` transitions).
   */
  present?: boolean | undefined;
  /** Starting style for the enter transition. Defaults to a fade + 16px lift. */
  enterStyle?: JSX.CSSProperties | undefined;
  /** Ending style for the exit transition. Defaults to `enterStyle`. */
  exitStyle?: JSX.CSSProperties | undefined;
};

const DEFAULT_ENTER: JSX.CSSProperties = {
  opacity: 0,
  transform: 'translateY(16px)',
};

export type MotionPhase = 'entering' | 'shown' | 'exiting' | 'gone';

type Presence = {
  phase: () => MotionPhase;
  /** Call once the entering styles have been committed to the DOM. */
  onEnterPainted: () => void;
  onTransitionEnd: () => void;
};

function initialMotionPhase(present: boolean | undefined): MotionPhase {
  if (present === undefined) return 'shown';
  if (present === false) return 'gone';
  return 'entering';
}

function createPresence(
  present: () => boolean | undefined,
  durationMs: () => number,
  timers: Timers
): Presence {
  const [phase, setPhase] = createSignal<MotionPhase>(
    initialMotionPhase(present())
  );
  let handle: unknown;
  const clear = (): void => {
    if (handle !== undefined) timers.clearTimeout(handle);
    handle = undefined;
  };
  onCleanup(clear);
  const finishExit = (): void => {
    clear();
    if (phase() === 'exiting') setPhase('gone');
  };
  createEffect(
    on(
      present,
      (value) => {
        if (value === false) {
          if (phase() === 'gone') return;
          setPhase('exiting');
          clear();
          // Fallback when no `transitionend` fires (zero duration, hidden tab).
          handle = timers.setTimeout(finishExit, durationMs() + 50);
        } else if (phase() === 'gone' || phase() === 'exiting') {
          clear();
          setPhase('entering');
        }
      },
      { defer: true }
    )
  );
  return {
    phase,
    onEnterPainted: () => {
      if (phase() === 'entering') setPhase('shown');
    },
    onTransitionEnd: finishExit,
  };
}

function mergeStyles(
  ...parts: (JSX.CSSProperties | string | undefined | false)[]
): JSX.CSSProperties | string | undefined {
  const objects: JSX.CSSProperties[] = [];
  const strings: string[] = [];
  for (const part of parts) {
    if (part === undefined || part === false) continue;
    if (typeof part === 'string') strings.push(part);
    else objects.push(part);
  }
  if (objects.length === 0 && strings.length === 0) return undefined;
  if (objects.length === 0) return strings.join(';');
  const merged = Object.assign({}, ...objects) as JSX.CSSProperties;
  if (strings.length === 0) return merged;
  return `${strings.join(';')};${Object.entries(merged)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      const prop = k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
      return `${prop}:${String(v)}`;
    })
    .join(';')}`;
}

export function Motion(props: MotionProps): JSX.Element {
  const tokens = useThemeTokens();
  const timers = useTimers();
  const [local, rest] = splitProps(props, [
    'duration',
    'easing',
    'property',
    'present',
    'enterStyle',
    'exitStyle',
    'class',
    'style',
    'ref',
    'dataSet',
  ]);
  const durationKey = () => local.duration ?? 'normal';
  const presence = createPresence(
    () => local.present,
    () => tokens.motion.duration[durationKey()],
    timers
  );
  const transitionStyle = (): JSX.CSSProperties => ({
    'transition-property': local.property ?? 'all',
    'transition-duration': `var(--ui-duration-${durationKey()})`,
    'transition-timing-function': `var(--ui-easing-${local.easing ?? 'standard'})`,
  });
  const phaseStyle = (): JSX.CSSProperties | undefined => {
    const p = presence.phase();
    if (p === 'entering') return local.enterStyle ?? DEFAULT_ENTER;
    if (p === 'exiting')
      return local.exitStyle ?? local.enterStyle ?? DEFAULT_ENTER;
    return undefined;
  };
  const mount = (el: HTMLDivElement): void => {
    if (typeof local.ref === 'function') {
      local.ref(el);
    }
    // After the synchronous render commits the node, flush the `entering`
    // styles so the switch to `shown` runs as a transition.
    queueMicrotask(() => {
      void el.getBoundingClientRect();
      presence.onEnterPainted();
    });
  };
  return (
    <Show when={presence.phase() !== 'gone'}>
      <div
        class={local.class ? `box ${local.class}` : 'box'}
        {...dataAttrs({ component: 'Motion', ...local.dataSet })}
        style={mergeStyles(transitionStyle(), local.style, phaseStyle())}
        ref={(el) => mount(el)}
        onTransitionEnd={presence.onTransitionEnd}
        {...rest}
      />
    </Show>
  );
}
