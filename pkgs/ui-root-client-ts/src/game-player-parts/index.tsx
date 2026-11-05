/** @jsxImportSource solid-js */
/**
 * The pieces a player strip (`GamePlayerBar`) and a player chip
 * (`GamePlayerChip`) share, so a seat says the same thing the same way at
 * either size: its figure (score, walls, a clock-like count) and whether the
 * player is out or reconnecting. Each state is a word in a tag, never a
 * color alone. The caller supplies every word.
 */

import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import type { JSX } from 'solid-js';
import { Badge } from '../badge/index';
import { StatusDot } from '../status-dot/index';

/** One figure about a seat: what it is and its value (`Score`, `12`). */
export type GameSeatStat = { label: string; value: string };

/** A player no longer in the round, or whose connection is being restored. */
export type GamePlayerStateKind = 'out' | 'reconnecting';

/** The state and the word that says it (`Out`, `Reconnecting`). */
export type GamePlayerState = {
  kind: GamePlayerStateKind;
  label: JSX.Element;
};

/** The state as a tag: neutral when out, the warning wash when reconnecting. */
export function GamePlayerStateBadge(props: {
  state: GamePlayerState;
}): JSX.Element {
  return (
    <Badge
      label={props.state.label}
      intent={props.state.kind === 'reconnecting' ? 'warning' : 'neutral'}
      dot={props.state.kind === 'reconnecting' ? 'pending' : undefined}
      dataSet={{ component: 'GamePlayerState', state: props.state.kind }}
    />
  );
}

/**
 * The seat's figure at the far edge: the label in the caption style over the
 * value in the `stat` style, in reading order.
 */
export function GameSeatStatValue(props: {
  stat: GameSeatStat;
  /** Ink of the soft tint when the seat is the active one. */
  active: boolean;
}): JSX.Element {
  return (
    <span
      class="box shrink-0 items-end min-w-0"
      {...dataAttrs({ component: 'GameSeatStat', value: props.stat.value })}
    >
      <span
        class="text textCaption whitespace-nowrap"
        classList={{ 'text-on-primary-soft': props.active }}
      >
        {props.stat.label}
      </span>
      <span
        class="text textStat textNumeral whitespace-nowrap"
        classList={{ 'text-on-primary-soft': props.active }}
      >
        {props.stat.value}
      </span>
    </span>
  );
}

/**
 * A seat's figure on one line, its label before its value (`Wins 3`), for
 * a compact chip whose width belongs to the player's name.
 */
export function GameSeatStatInline(props: {
  stat: GameSeatStat;
  /** Ink of the soft tint when the seat is the active one. */
  active: boolean;
}): JSX.Element {
  return (
    <span
      class="text textCaption whitespace-nowrap"
      classList={{ 'text-on-primary-soft': props.active }}
      {...dataAttrs({ component: 'GameSeatStat', value: props.stat.value })}
    >
      {props.stat.label}{' '}
      <span class="textNumeral font-semibold">{props.stat.value}</span>
    </span>
  );
}

const READINESS_DOT_SIZE = 8;

/**
 * Whether a seat's holder is ready, as a status dot and its word in the
 * caption style (`Ready`, `Getting ready`) — not a tag, so a seat's row
 * keeps one tag style for its facts. The dot is the success color when
 * ready and the quiet outline color while getting ready; the word always
 * says it, never the color alone.
 */
export function GameSeatReadiness(props: {
  ready: boolean;
  label: JSX.Element;
}): JSX.Element {
  return (
    <span
      class="box flex-row shrink-0 items-center gap-1 min-w-0"
      {...dataAttrs({
        component: 'GameSeatReadiness',
        ready: String(props.ready),
      })}
    >
      <StatusDot
        status={props.ready ? 'online' : undefined}
        color={props.ready ? undefined : colorVar('outline')}
        size={READINESS_DOT_SIZE}
      />
      <span
        class="text textCaption whitespace-nowrap"
        classList={{
          'text-success': props.ready,
          'text-text-secondary': !props.ready,
        }}
      >
        {props.label}
      </span>
    </span>
  );
}
