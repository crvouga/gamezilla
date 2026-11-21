/** @jsxImportSource solid-js */
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { FloatingActionButton } from '@pkgs/ui-root-client-ts/floating-action-button';
import { PlusIcon, SquarePenIcon } from '@pkgs/ui-root-client-ts/icons';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const DEMO_MS = 900;

const LABELS = {
  idle: 'Create',
  loading: 'Creating…',
  success: 'Created',
  error: "Couldn't create",
};

function FabDemo(): JSX.Element {
  const timers = useTimers();
  const delay = (ms: number): Promise<void> =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
  const succeed = useMutationButton({
    operation: () => delay(DEMO_MS),
    labels: LABELS,
  });
  const fail = useMutationButton({
    operation: async () => {
      await delay(DEMO_MS);
      throw new Error('Network unreachable');
    },
    labels: LABELS,
  });

  return (
    <div class="box gap-2">
      <p class="text textFootnote">
        {'Feedback: tap to run (loading → success / error)'}
      </p>
      <div class="box flex-row flex-wrap gap-4 items-center">
        <FloatingActionButton {...succeed.fabProps} />
        <FloatingActionButton {...fail.fabProps} />
      </div>
    </div>
  );
}

function FabStates(): JSX.Element {
  return (
    <div class="box gap-2">
      <p class="text textFootnote">
        {'Round 52px, extended, loading, disabled'}
      </p>
      <div class="box flex-row flex-wrap gap-4 items-center">
        <FloatingActionButton aria-label="New" icon={PlusIcon} />
        <FloatingActionButton
          aria-label="Compose"
          icon={SquarePenIcon}
          label="Compose"
        />
        <FloatingActionButton aria-label="Saving" loading />
        <FloatingActionButton aria-label="New" disabled />
      </div>
    </div>
  );
}

export default function FloatingActionButtonExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box gap-4">
          <FabStates />
          <FabDemo />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
