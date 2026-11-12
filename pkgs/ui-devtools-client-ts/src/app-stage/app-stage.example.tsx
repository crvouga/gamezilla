/** @jsxImportSource solid-js */

import {
  AppStage,
  type AppStageView,
} from '@pkgs/ui-devtools-client-ts/app-stage';
import { ScrollTextIcon } from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX, untrack } from 'solid-js';
import { ExampleRoot } from '../../../ui-root-client-ts/storybook/fixtures/example-root';

/** A stand-in for a whole app: a title, and a count that shows it kept its state. */
function Screen(props: {
  readonly name: string;
  readonly note: string;
}): JSX.Element {
  const [count, setCount] = createSignal(0);
  return (
    <div class="box flex-1 gap-3 p-4">
      <h2 class="text textHeading">{props.name}</h2>
      <p class="text textBody text-text-secondary">{props.note}</p>
      <button
        type="button"
        class="self-start"
        onClick={() => setCount(count() + 1)}
      >
        {`${props.name} kept its state: ${String(count())}`}
      </button>
    </div>
  );
}

const VIEWS: readonly AppStageView[] = [
  {
    id: 'alice',
    title: 'Alice',
    live: true,
    content: () => (
      <Screen name="Alice" note="Press the handle for the next device." />
    ),
  },
  {
    id: 'bob',
    title: 'Bob',
    live: true,
    content: () => (
      <Screen name="Bob" note="Hold the handle for everything else." />
    ),
  },
  {
    id: 'logs',
    title: 'Logs',
    content: () => (
      <Screen name="Logs" note="Mounted the first time it is shown." />
    ),
  },
];

const DEVICES = ['alice', 'bob'];

export type AppStageExampleProps = {
  /** The view on show when the example opens. Default `alice`. */
  readonly shown?: string | undefined;
};

/** A stage with two live devices and one view behind them. */
export function AppStageDemo(props: AppStageExampleProps): JSX.Element {
  const [shown, setShown] = createSignal(untrack(() => props.shown) ?? 'alice');
  const [held, setHeld] = createSignal(false);
  const title = () => VIEWS.find((view) => view.id === shown())?.title ?? '';
  return (
    <div class="box h-96 border border-solid border-border">
      <AppStage
        aria-label="Devices"
        shown={shown()}
        views={[...VIEWS]}
        handle={{
          label: `${title()} is on show. Press for the next device, hold for the menu.`,
          text: shown() === 'logs' ? undefined : title().slice(0, 2),
          icon: shown() === 'logs' ? ScrollTextIcon : undefined,
          expanded: held(),
          onTap: () => {
            setHeld(false);
            setShown(
              DEVICES[(DEVICES.indexOf(shown()) + 1) % DEVICES.length] ??
                'alice'
            );
          },
          // A menu would open here; the example goes behind the devices.
          onHold: () => {
            setHeld(true);
            setShown('logs');
          },
        }}
      />
    </div>
  );
}

export default function AppStageExample(
  props: AppStageExampleProps
): JSX.Element {
  return (
    <ExampleRoot>
      <AppStageDemo {...props} />
    </ExampleRoot>
  );
}
