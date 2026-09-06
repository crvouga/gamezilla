/** @jsxImportSource solid-js */
/**
 * `Motion` -- a `Box` whose `sx` changes animate with a CSS transition.
 *
 * Replaces JS-driven animated views: set reactive `sx` (opacity, transform,
 * colors, sizes) and the browser interpolates on the compositor. Pass
 * `present={false}` to play `exitSx` and unmount after the transition.
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
import {
  type DurationKey,
  type EasingKey,
  type SxInput,
  useThemeTokens,
} from '../../theme';
import { Box, type BoxProps } from '../box';

export type MotionProps = BoxProps & {
  /** Duration token. Defaults to `normal`. */
  duration?: DurationKey | undefined;
  /** Easing token. Defaults to `standard`. */
  easing?: EasingKey | undefined;
  /** CSS `transition-property`. Defaults to `all`. */
  property?: string | undefined;
  /**
   * Presence: when it flips to `false` the box plays `exitSx` and unmounts
   * after the transition; when `true` it mounts and plays from `enterSx`.
   * Omit for an always-mounted transitioning box.
   */
  present?: boolean | undefined;
  /** Starting style for the enter transition. Defaults to a fade + 4px lift. */
  enterSx?: SxInput | undefined;
  /** Ending style for the exit transition. Defaults to `enterSx`. */
  exitSx?: SxInput | undefined;
};

const DEFAULT_ENTER: SxInput = { opacity: 0, transform: [{ translateY: 4 }] };

export type MotionPhase = 'entering' | 'shown' | 'exiting' | 'gone';

type Presence = {
  phase: () => MotionPhase;
  /** Call once the entering styles have been committed to the DOM. */
  onEnterPainted: () => void;
  onTransitionEnd: () => void;
};

function createPresence(
  present: () => boolean | undefined,
  durationMs: () => number,
  timers: Timers
): Presence {
  const [phase, setPhase] = createSignal<MotionPhase>(
    present() === false ? 'gone' : 'entering'
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

export function Motion(props: MotionProps): JSX.Element {
  const tokens = useThemeTokens();
  const timers = useTimers();
  const [local, rest] = splitProps(props, [
    'duration',
    'easing',
    'property',
    'present',
    'enterSx',
    'exitSx',
    'sx',
    'ref',
  ]);
  const durationKey = () => local.duration ?? 'normal';
  const presence = createPresence(
    () => local.present,
    () => tokens.motion.duration[durationKey()],
    timers
  );
  const transitionSx = (): SxInput => ({
    transitionProperty: local.property ?? 'all',
    transitionDuration: `var(--ui-duration-${durationKey()})`,
    transitionTimingFunction: `var(--ui-easing-${local.easing ?? 'standard'})`,
  });
  const phaseSx = (): SxInput => {
    const p = presence.phase();
    if (p === 'entering') return local.enterSx ?? DEFAULT_ENTER;
    if (p === 'exiting') return local.exitSx ?? local.enterSx ?? DEFAULT_ENTER;
    return false;
  };
  const mount = (el: HTMLElement): void => {
    local.ref?.(el);
    // After the synchronous render commits the node, flush the `entering`
    // styles so the switch to `shown` runs as a transition.
    queueMicrotask(() => {
      void el.getBoundingClientRect();
      presence.onEnterPainted();
    });
  };
  return (
    <Show when={presence.phase() !== 'gone'}>
      <Box
        ref={mount}
        sx={[transitionSx(), local.sx, phaseSx()]}
        onTransitionEnd={presence.onTransitionEnd}
        dataSet={{ component: 'Motion', ...rest.dataSet }}
        {...rest}
      />
    </Show>
  );
}
