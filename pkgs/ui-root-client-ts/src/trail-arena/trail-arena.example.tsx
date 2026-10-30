import { DirectionPad } from '@pkgs/ui-root-client-ts/direction-pad';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { TrailArena } from '@pkgs/ui-root-client-ts/trail-arena';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';
import {
  type ExampleRound,
  paintCells,
  rider,
  stepRound,
} from '../../storybook/fixtures/trail-arena-example-data';

const WIDTH = 40;
const HEIGHT = 28;
const PAD_LABELS = {
  up: 'Steer up',
  right: 'Steer right',
  down: 'Steer down',
  left: 'Steer left',
};

function freshDuel(controlled: 1 | 2): ExampleRound {
  return {
    cells: paintCells(['6,14 9,14', '33,14 30,14']),
    riders: [
      rider(0, [10, 14], 'right', { controlled: true }),
      rider(1, [29, 14], 'left', { controlled: controlled === 2 }),
    ],
    crashes: [],
  };
}

/** Each press rides one cell, so the controls can be tried without a clock. */
function SteeredArena(props: {
  initialRound: ExampleRound;
  label: string;
  help: string;
  helpId: string;
  testId: string;
}): JSX.Element {
  const [round, setRound] = createSignal(props.initialRound);
  return (
    <StackVertical gap="md">
      <P id={props.helpId}>{props.help}</P>
      <TrailArena
        width={WIDTH}
        height={HEIGHT}
        cells={round().cells}
        riders={round().riders}
        crashes={round().crashes}
        enabled={true}
        label={props.label}
        instructionsId={props.helpId}
        testId={props.testId}
        onDirection={(heading, slot) =>
          setRound((current) => stepRound(current, heading, slot))
        }
      />
      <DirectionPad
        labels={PAD_LABELS}
        disabled={false}
        testId={`${props.testId}-pad`}
        onDirection={(heading) =>
          setRound((current) => stepRound(current, heading, 0))
        }
      />
    </StackVertical>
  );
}

const TRIO_CELLS = paintCells([
  '4,4 20,4 20,12',
  '35,23 24,23 24,11 22,11',
  '4,23 12,23 12,9 18,9',
]);

const QUAD_CELLS = paintCells([
  '4,4 6,4',
  '35,23 33,23',
  '4,23 4,21',
  '35,4 35,6',
]);

const RESULT_CELLS = paintCells([
  '4,4 30,4 30,20 10,20 10,8 25,8 25,15',
  '35,23 35,10 33,10 33,22 14,22',
  '4,23 8,23 8,6 4,6 4,21',
  '38,1 30,1 30,2',
]);

function WatchedArenas(): JSX.Element {
  return (
    <>
      <ExampleSection title="Trio, watched: Ember crashed into Comet's trail">
        <TrailArena
          width={WIDTH}
          height={HEIGHT}
          cells={TRIO_CELLS}
          riders={[
            rider(0, [20, 13], 'down'),
            rider(1, [21, 11], 'left', { alive: false }),
            rider(2, [19, 9], 'right'),
          ]}
          crashes={[{ index: 1, x: 21, y: 11 }]}
          enabled={false}
          label="Trio arena, watching"
          instructionsId="trail-arena-example-watch"
          testId="trail-arena-trio"
          onDirection={() => undefined}
        />
      </ExampleSection>
      <ExampleSection title="Quad, countdown before the round">
        <TrailArena
          width={WIDTH}
          height={HEIGHT}
          cells={QUAD_CELLS}
          riders={[
            rider(0, [7, 4], 'right', { controlled: true }),
            rider(1, [32, 23], 'left'),
            rider(2, [4, 20], 'up'),
            rider(3, [35, 7], 'down'),
          ]}
          crashes={[]}
          overlay={{ title: '3', detail: 'Round 2' }}
          enabled={false}
          label="Quad arena, countdown"
          instructionsId="trail-arena-example-watch"
          testId="trail-arena-quad"
          onDirection={() => undefined}
        />
      </ExampleSection>
      <ExampleSection title="Quad, round over: three crashes and a result">
        <TrailArena
          width={WIDTH}
          height={HEIGHT}
          cells={RESULT_CELLS}
          riders={[
            rider(0, [25, 16], 'down', { controlled: true }),
            rider(1, [14, 21], 'up', { alive: false }),
            rider(2, [4, 22], 'down', { alive: false }),
            rider(3, [30, 3], 'down', { alive: false }),
          ]}
          crashes={[
            { index: 1, x: 14, y: 21 },
            { index: 2, x: 4, y: 22 },
            { index: 3, x: 30, y: 3 },
          ]}
          overlay={{
            title: 'Comet wins the round',
            detail: 'Comet 2, Ember 1',
          }}
          enabled={false}
          label="Quad arena, round over"
          instructionsId="trail-arena-example-watch"
          testId="trail-arena-result"
          onDirection={() => undefined}
        />
      </ExampleSection>
    </>
  );
}

export default function TrailArenaExample(): JSX.Element {
  return (
    <ExampleRoot>
      <StackVertical gap="xl">
        <ExampleSection title="Duel, steered here">
          <SteeredArena
            initialRound={freshDuel(1)}
            label="Duel arena"
            help="Focus the arena. Steer Comet with the arrow keys, WASD, a swipe or the pad; each press rides one cell."
            helpId="trail-arena-example-one"
            testId="trail-arena-duel"
          />
        </ExampleSection>
        <ExampleSection title="Duel, two riders on one keyboard">
          <SteeredArena
            initialRound={freshDuel(2)}
            label="Shared keyboard arena"
            help="Comet steers with the arrow keys, Ember with WASD. The pad steers Comet."
            helpId="trail-arena-example-two"
            testId="trail-arena-shared"
          />
        </ExampleSection>
        <P id="trail-arena-example-watch" tone="secondary">
          These arenas are read-only: nothing here is steered from this device.
        </P>
        <WatchedArenas />
      </StackVertical>
    </ExampleRoot>
  );
}
