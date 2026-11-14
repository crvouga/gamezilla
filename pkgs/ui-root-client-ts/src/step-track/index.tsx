/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { Index, type JSX, Show } from 'solid-js';
import { CheckIcon } from '../icons';
import styles from './step-track.module.css';

/** `done` is behind the person, `current` is the one next step, `upcoming` waits. */
export type StepTrackState = 'done' | 'current' | 'upcoming';

export type StepTrackStep = {
  readonly key: string;
  /** The step's name: read beside its marker when the step has no action. */
  readonly label: string;
  readonly state: StepTrackState;
  /**
   * What the person presses to take the step (a `Button`): a step that
   * waits is `locked`, a step behind the person an outline.
   */
  readonly action?: JSX.Element | undefined;
  readonly dataSet?: ComponentDataSet | undefined;
};

export type StepTrackProps = {
  /** Names the sequence for assistive technology (`Steps to publish`). */
  readonly label: string;
  readonly steps: readonly StepTrackStep[];
  /**
   * Each state's word, read after the step's name (`Next`, `Done`,
   * `Locked`), so a step reads as one short line: number, name, state.
   */
  readonly stateNames: Readonly<Record<StepTrackState, string>>;
  readonly dataSet?: ComponentDataSet | undefined;
};

/**
 * `StepTrack` -- a short sequence of steps read in order, as one panel of
 * rows: each row a marker (a check once done, its number while it waits,
 * filled when it is the one next step), the step's name, its state in a
 * word at the row's end, and its own action (a `Button`) under the name. A waiting step's action stands in for its
 * name, locked, so it still says what is missing when pressed. Steps keep their place (by position) as
 * their states change, so an action keeps its own state.
 */
export function StepTrack(props: StepTrackProps): JSX.Element {
  return (
    <div
      class={styles['frame']}
      {...dataAttrs({ component: 'StepTrack', ...props.dataSet })}
    >
      <ol class={`panel ${styles['track']}`} aria-label={props.label}>
        <Index each={props.steps}>
          {(step, index) => (
            <li
              class={`panelItem ${styles['step']}`}
              {...dataAttrs({ state: step().state, ...step().dataSet })}
              aria-current={step().state === 'current' ? 'step' : undefined}
            >
              <span class={styles['marker']} aria-hidden="true">
                <Show when={step().state === 'done'} fallback={index + 1}>
                  <CheckIcon size={14} />
                </Show>
              </span>
              <span class={styles['body']}>
                {/* A waiting step's own action is its name (a locked
                    button that says what is missing); any other step's
                    action follows its name. */}
                <Show
                  when={step().state === 'upcoming' && step().action}
                  fallback={<span class={styles['name']}>{step().label}</span>}
                >
                  {step().action}
                </Show>
                <Show when={step().state !== 'upcoming' && step().action}>
                  <span class={styles['action']}>{step().action}</span>
                </Show>
              </span>
              <span class={styles['state']}>
                {props.stateNames[step().state]}
              </span>
            </li>
          )}
        </Index>
      </ol>
    </div>
  );
}
