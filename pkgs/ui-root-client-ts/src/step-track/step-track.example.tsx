import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Button } from '../button/index';
import { StepTrack } from './index';

const STATE_NAMES = { done: 'Done', current: 'Next', upcoming: 'Later' };

/**
 * A builder's last steps: one done, the next one (its action filled above
 * the track, so here just its name), one locked behind it; then a pack
 * whose first step is next and whose later steps wait, locked.
 */
export default function StepTrackExample(): JSX.Element {
  return (
    <ExampleRoot>
      <StepTrack
        label="Steps to publish"
        stateNames={STATE_NAMES}
        steps={[
          {
            key: 'playtest',
            label: 'Playtest',
            state: 'done',
            action: (
              <Button
                title="Start playtest"
                intent="neutral"
                variant="outline"
              />
            ),
          },
          { key: 'validate', label: 'Validate', state: 'current' },
          {
            key: 'publish',
            label: 'Publish',
            state: 'upcoming',
            action: (
              <Button title="Publish" intent="neutral" variant="ghost" locked />
            ),
            note: 'After validation',
          },
        ]}
      />
      <StepTrack
        label="Steps to publish a pack"
        stateNames={STATE_NAMES}
        steps={[
          { key: 'puzzles', label: 'Publish its puzzles', state: 'current' },
          {
            key: 'validate',
            label: 'Validate',
            state: 'upcoming',
            action: (
              <Button
                title="Validate"
                intent="neutral"
                variant="ghost"
                locked
              />
            ),
            note: 'After its puzzles',
          },
          {
            key: 'publish',
            label: 'Publish',
            state: 'upcoming',
            action: (
              <Button title="Publish" intent="neutral" variant="ghost" locked />
            ),
            note: 'After validation',
          },
        ]}
      />
    </ExampleRoot>
  );
}
