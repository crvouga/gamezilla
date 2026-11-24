/** @jsxImportSource @solidjs/web */

import type { JSX } from '@solidjs/web';
import { Match, Show, Switch } from 'solid-js';
import {
  CheckIcon,
  CrownIcon,
  EllipsisIcon,
  EyeIcon,
  LayoutGridIcon,
  MicOffIcon,
  MoonIcon,
  PlayIcon,
  SlidersHorizontalIcon,
} from '../icons';
import type { SpacePersonStatus } from '../space-types';
import styles from './space-people-row.module.css';

const GLYPH = 12;

/** The paint a status badge takes: busy work in the accent, done in green. */
function statusTone(status: SpacePersonStatus): string {
  if (status === 'choosing' || status === 'settingUp') return 'busy';
  if (status === 'ready') return 'ready';
  if (status === 'turn') return 'turn';
  return 'quiet';
}

function StatusGlyph(props: { status: SpacePersonStatus }): JSX.Element {
  return (
    <Switch>
      <Match when={props.status === 'choosing'}>
        <LayoutGridIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
      </Match>
      <Match when={props.status === 'watching'}>
        <EyeIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
      </Match>
      <Match when={props.status === 'settingUp'}>
        <SlidersHorizontalIcon
          size={GLYPH}
          color="currentColor"
          strokeWidth={2.5}
        />
      </Match>
      <Match when={props.status === 'notReady'}>
        <EllipsisIcon size={GLYPH} color="currentColor" strokeWidth={3} />
      </Match>
      <Match when={props.status === 'ready'}>
        <CheckIcon size={GLYPH} color="currentColor" strokeWidth={3} />
      </Match>
      <Match when={props.status === 'turn'}>
        <PlayIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
      </Match>
      <Match when={props.status === 'away'}>
        <MoonIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
      </Match>
    </Switch>
  );
}

/**
 * The marks over a space avatar: the host's crown at the top end, the
 * status at the bottom end, the muted microphone at the bottom start. Each
 * is its own shape; the cell's accessible name says them in words.
 */
export function SpacePersonBadges(props: {
  host: boolean;
  status: SpacePersonStatus | undefined;
  muted: boolean;
}): JSX.Element {
  return (
    <>
      <Show when={props.host}>
        <span class={styles['badge']} data-slot="role" data-badge="host">
          <CrownIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
        </span>
      </Show>
      <Show when={props.status}>
        {(status) => (
          <span
            class={styles['badge']}
            data-slot="status"
            data-badge={status()}
            data-tone={statusTone(status())}
          >
            <StatusGlyph status={status()} />
          </span>
        )}
      </Show>
      <Show when={props.muted}>
        <span class={styles['badge']} data-slot="mute" data-badge="muted">
          <MicOffIcon size={GLYPH} color="currentColor" strokeWidth={2.5} />
        </span>
      </Show>
    </>
  );
}
