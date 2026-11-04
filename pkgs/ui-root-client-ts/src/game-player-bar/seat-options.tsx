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
import seat from './seat-options.module.css';

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
 * The one trailing control of a compact seat: a short pill that says what
 * it does (`label`, e.g. "Change") beside a chevron, opening its choices
 * below. The same pill on every size, small enough that the seat's holder
 * ("Bot (medium)") keeps the room to be read whole on a phone.
 */
export function SeatOptionsToggle(props: {
  state: SeatOptionsState;
  label: JSX.Element;
  dataSet?: ComponentDataSet | undefined;
}): JSX.Element {
  return (
    <button
      type="button"
      class={`${seat['seatToggle']} clickable clickableTint rounded-full`}
      aria-expanded={props.state.open()}
      aria-controls={props.state.id}
      onClick={() => props.state.toggle()}
      {...dataAttrs({ component: 'GamePlayerOptionsToggle', ...props.dataSet })}
    >
      <span class={`${seat['seatToggleLabel']} text textFootnote`}>
        {props.label}
      </span>
      <span
        class={`${styles['chevron']} ${seat['seatToggleChevron']}`}
        data-open={props.state.open()}
        aria-hidden="true"
      >
        <ChevronDownIcon size={16} />
      </span>
    </button>
  );
}

/** The seat's choices, under its row while open. */
export function SeatOptions(props: { state: SeatOptionsState }): JSX.Element {
  return (
    <Show when={props.state.present() && props.state.open()}>
      <div id={props.state.id} class={seat['seatOptions']}>
        {props.state.content()}
      </div>
    </Show>
  );
}
