/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  StepTrack,
  type StepTrackStep,
} from '@pkgs/ui-root-client-ts/step-track';
import { createSignal } from 'solid-js';
import { mustQuery, renderUi } from './render';

const NAMES = { done: 'Done', current: 'Next', upcoming: 'Later' };

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
    expect(steps.map((step) => step.textContent)).toEqual([
      'Done: Playtest',
      '2Next: Validate',
      '3Later: Publish',
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
    expect(mustQuery('[data-component="StepTrack"] button')).toBe(button);
    expect(
      mustQuery('[data-component="StepTrack"] li').getAttribute('data-state')
    ).toBe('done');
  });

  test('stacks one step a line when its container is narrow', () => {
    const css = readFileSync(
      join(
        import.meta.dirname,
        '../../ui-root-client-ts/src/step-track/step-track.module.css'
      ),
      'utf8'
    );
    expect(css).toContain('container: step-track / inline-size;');
    const narrow = css.slice(css.indexOf('@container step-track (max-width'));
    expect(narrow).toMatch(/\.track \{\s*flex-direction: column;/);
  });
});
