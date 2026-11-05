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
 * `StepTrack` -- a short sequence of steps read in order, each with a
 * marker: a check once done, its number while it waits, filled when it is
 * the one next step. A step holds its own action or just its name, then
 * its state in a word (`2 Validate · Locked`). One
 * row joined by hairlines where it fits; one step a line where its
 * container is narrow. Steps keep their place (by position) as their
 * states change, so an action keeps its own state.
 */
export function StepTrack(props: StepTrackProps): JSX.Element {
  return (
    <div
      class={styles['frame']}
      {...dataAttrs({ component: 'StepTrack', ...props.dataSet })}
    >
      <ol class={styles['track']} aria-label={props.label}>
        <Index each={props.steps}>
          {(step, index) => (
            <li
              class={styles['step']}
              {...dataAttrs({ state: step().state, ...step().dataSet })}
              aria-current={step().state === 'current' ? 'step' : undefined}
            >
              <span class={styles['marker']} aria-hidden="true">
                <Show when={step().state === 'done'} fallback={index + 1}>
                  <CheckIcon size={14} />
                </Show>
              </span>
              <Show
                when={step().action}
                fallback={<span class={styles['name']}>{step().label}</span>}
              >
                {step().action}
              </Show>
              <span class={styles['state']}>
                <span aria-hidden="true">·</span>
                {props.stateNames[step().state]}
              </span>
            </li>
          )}
        </Index>
      </ol>
    </div>
  );
}
