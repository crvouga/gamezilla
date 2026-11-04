/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  type Accessor,
  createSignal,
  createUniqueId,
  type JSX,
  Show,
} from 'solid-js';
import styles from '../game-ui.module.css';
import { ChevronDownIcon } from '../icons';
import { createScreenSlot } from '../screen-slot';

/** A seat's secondary choices and whether they are open. */
export type SeatOptionsState = {
  readonly id: string;
  readonly open: Accessor<boolean>;
  readonly toggle: () => void;
  readonly present: Accessor<boolean>;
  readonly content: Accessor<JSX.Element>;
};

export function useSeatOptions(read: Accessor<JSX.Element>): SeatOptionsState {
  const slot = createScreenSlot(read);
  const [open, setOpen] = createSignal(false);
  return {
    id: createUniqueId(),
    open,
    toggle: () => setOpen(!open()),
    present: slot.present,
    content: slot.content,
  };
}

/**
 * The one trailing control of a compact seat: a round chevron named by
 * `label` (for assistive technology and tooltips), opening its choices below.
 */
export function SeatOptionsToggle(props: {
  state: SeatOptionsState;
  label: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`${styles['seatToggle']} clickable clickableTint rounded-full`}
      aria-expanded={props.state.open()}
      aria-controls={props.state.id}
      onClick={() => props.state.toggle()}
      {...dataAttrs({ component: 'GamePlayerOptionsToggle', ...props.dataSet })}
    >
      <span class="sr-only">{props.label}</span>
      <span
        class={styles['chevron']}
        data-open={props.state.open()}
        aria-hidden="true"
      >
        <ChevronDownIcon size={18} />
      </span>
    </button>
  );
}

/** The seat's choices, under its row while open. */
export function SeatOptions(props: { state: SeatOptionsState }): JSX.Element {
  return (
    <Show when={props.state.present() && props.state.open()}>
      <div id={props.state.id} class={styles['seatOptions']}>
        {props.state.content()}
      </div>
    </Show>
  );
}
