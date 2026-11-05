import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Button } from '../button/index';
import { StepTrack } from './index';

const STATE_NAMES = { done: 'Done', current: 'Next', upcoming: 'Later' };

/** A builder's last steps: one done, the filled next one, one waiting. */
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
          {
            key: 'validate',
            label: 'Validate',
            state: 'current',
            action: (
              <Button title="Validate" intent="primary" variant="solid" />
            ),
          },
          {
            key: 'publish',
            label: 'Publish',
            state: 'upcoming',
            action: (
              <Button title="Publish" intent="neutral" variant="outline" />
            ),
          },
        ]}
      />
      <StepTrack
        label="Steps to publish a pack"
        stateNames={STATE_NAMES}
        steps={[
          { key: 'puzzles', label: 'Publish its puzzles', state: 'current' },
          { key: 'validate', label: 'Validate', state: 'upcoming' },
          { key: 'publish', label: 'Publish', state: 'upcoming' },
        ]}
      />
    </ExampleRoot>
  );
}
