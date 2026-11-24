/** @jsxImportSource @solidjs/web */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { createSignal, flush } from 'solid-js';
import { mustQuery, renderUi } from './render';

const NAMES = { done: 'Done', current: 'Next', upcoming: 'Locked' };

describe('StepTrack', () => {
  test('reads its steps in order: a check once done, a number until then', () => {
    renderUi(() => (
      <StepTrack
        label="Steps to publish"
        stateNames={NAMES}
        steps={[
          { key: 'a', label: 'Playtest', state: 'done' },
          { key: 'b', label: 'Validate', state: 'current' },
          { key: 'c', label: 'Publish', state: 'upcoming' },
        ]}
      />
    ));
    const list = mustQuery('[data-component="StepTrack"] ol');
    expect(list.getAttribute('aria-label')).toBe('Steps to publish');
    const steps = [...list.querySelectorAll('li')];
    expect(steps.map((step) => step.getAttribute('data-state'))).toEqual([
      'done',
      'current',
      'upcoming',
    ]);
    expect(steps.map((step) => step.getAttribute('aria-current'))).toEqual([
      null,
      'step',
      null,
    ]);
    expect(steps[0]?.querySelector('svg')).not.toBeNull();
    // regression: builder-stepper-hard-to-parse — a waiting step read its
    // name, then what it waited on ("Validate After its puzzles"), with its
    // state for assistive technology only, so the track ran together. Each
    // step now reads as one short row: number, name, state.
    expect(steps.map((step) => step.textContent)).toEqual([
      'PlaytestDone',
      '2ValidateNext',
      '3PublishLocked',
    ]);
  });

  test('a step keeps its action element as its state changes', () => {
    const action = <button type="button">Validate</button>;
    const [state, setState] = createSignal<StepTrackStep['state']>('current');
    renderUi(() => (
      <StepTrack
        label="Steps"
        stateNames={NAMES}
        steps={[{ key: 'v', label: 'Validate', state: state(), action }]}
      />
    ));
    const button = mustQuery('[data-component="StepTrack"] button');
    setState('done');
    flush();
    expect(mustQuery('[data-component="StepTrack"] button')).toBe(button);
    expect(
      mustQuery('[data-component="StepTrack"] li').getAttribute('data-state')
    ).toBe('done');
  });

  test('reads one step a row, at every width', () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/step-track/step-track.module.css'
      ),
      'utf8'
    );
    expect(css).not.toContain('@container');
    expect(css).toMatch(/\.step \{\s*display: grid;/);
  });
});
