/** @jsxImportSource solid-js */
/**
 * `Switch` -- on/off toggle rendered as `<button role="switch">`.
 */

import { type JSX, Show } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import { Box } from '../box';
import { Clickable } from '../clickable';
import styles from '../hosts.module.css';
import { Text } from '../text';

export type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  /** Optional label displayed next to the switch. */
  label?: JSX.Element | undefined;
  disabled?: boolean | undefined;
  'aria-label'?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 26;
const THUMB = 22;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB - 4;

export function Switch(props: SwitchProps): JSX.Element {
  return (
    <Box
      dataSet={{ component: 'Switch', ...props.dataSet }}
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
    >
      <Clickable
        role="switch"
        aria-checked={props.value}
        aria-label={props['aria-label']}
        disabled={props.disabled}
        feedback="none"
        class={styles['switchTrack']}
        onClick={() => props.onValueChange(!props.value)}
        sx={{
          width: TRACK_WIDTH,
          height: TRACK_HEIGHT,
          minHeight: 44,
          justifyContent: 'center',
          opacity: props.disabled ? 0.5 : 1,
        }}
      >
        <Box
          sx={{
            width: TRACK_WIDTH,
            height: TRACK_HEIGHT,
            borderRadius: 'full',
            backgroundColor: props.value ? 'tint' : 'outline',
            justifyContent: 'center',
            transitionProperty: 'background-color',
            transitionDuration: 'var(--ui-duration-fast)',
          }}
        >
          <Box
            class={styles['switchThumb']}
            sx={{
              width: THUMB,
              height: THUMB,
              borderRadius: 'full',
              backgroundColor: 'onPrimary',
              ml: 0.5,
              transform: [{ translateX: props.value ? THUMB_TRAVEL : 0 }],
            }}
          />
        </Box>
      </Clickable>
      <Show when={props.label !== undefined}>
        <Text variant="body" label={props.label} />
      </Show>
    </Box>
  );
}
