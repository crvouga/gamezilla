import { actionLabel, fmtMs } from '@pkgs/harness-report-shared/format';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import {
  firstFrameFor,
  lastFrameBefore,
} from '@pkgs/harness-report-shared/frames';
import type { ScenarioLine } from '@pkgs/harness-report-shared/scenario';
import {
  gherkinText,
  scenarioScript,
} from '@pkgs/harness-report-shared/scenario';
import type { ReportStep } from '@pkgs/harness-shared/report-types';
import { createMemo, For, Show } from 'solid-js';

function pickFrame(
  step: ReportStep,
  frames: readonly FlatFrame[]
): FlatFrame | null {
  return firstFrameFor(step, frames) || lastFrameBefore(step, frames);
}

function LineButton(props: {
  step: ReportStep;
  frames: readonly FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (frame: FlatFrame | null) => void;
  script: boolean;
}) {
  const on = () => props.selected?.step === props.step;
  const choose = () => props.onSelect(pickFrame(props.step, props.frames));
  return (
    <button
      type="button"
      class={props.script ? 'sr-gherkin' : 'sr-action'}
      classList={{ on: on() }}
      aria-current={on() ? 'true' : undefined}
      onClick={choose}
    >
      <Show
        when={props.script}
        fallback={
          <span class="act">
            {props.step.action ? actionLabel(props.step) : props.step.title}
          </span>
        }
      >
        <span class="k">{props.step.kind}</span>
        <span class="txt">{gherkinText(props.step)}</span>
        <span class="d">{fmtMs(props.step.durationMs)}</span>
      </Show>
    </button>
  );
}

function ScenarioLineView(props: {
  line: ScenarioLine;
  frames: readonly FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (frame: FlatFrame | null) => void;
}) {
  return (
    <li class={props.line.step.status}>
      <LineButton
        step={props.line.step}
        frames={props.frames}
        selected={props.selected}
        onSelect={props.onSelect}
        script
      />
      <Show when={props.line.actions.length > 0}>
        <ul class="sr-actions">
          <For each={props.line.actions}>
            {(action) => (
              <li>
                <LineButton
                  step={action}
                  frames={props.frames}
                  selected={props.selected}
                  onSelect={props.onSelect}
                  script={false}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>
    </li>
  );
}

/** The scenario, one Gherkin line per step, with the actions taken under it. */
export function ScenarioScript(props: {
  steps: readonly ReportStep[];
  frames: readonly FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (frame: FlatFrame | null) => void;
}) {
  const lines = createMemo(() => scenarioScript(props.steps));
  return (
    <Show when={lines()}>
      {(script) => (
        <ol class="sr-scenario" aria-label="Scenario">
          <For each={script()}>
            {(line) => (
              <ScenarioLineView
                line={line}
                frames={props.frames}
                selected={props.selected}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </ol>
      )}
    </Show>
  );
}
