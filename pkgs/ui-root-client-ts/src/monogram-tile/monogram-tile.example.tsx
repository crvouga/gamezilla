import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { MonogramTile, type MonogramTileSize } from './index';

const NAMES = [
  ['5bace000-0000-4000-8000-000000000001', 'Friday game night'],
  ['5bace000-0000-4000-8000-000000000002', "robin_42's space"],
  ['5bace000-0000-4000-8000-000000000003', "sam's space"],
  ['5bace000-0000-4000-8000-000000000004', 'Sunday puzzle club'],
  ['5bace000-0000-4000-8000-000000000005', 'Chess club'],
  ['5bace000-0000-4000-8000-000000000006', '🎲 dice night'],
  ['5bace000-0000-4000-8000-000000000007', 'Échecs'],
] as const;

const SIZES: readonly MonogramTileSize[] = ['xs', 'sm', 'md', 'lg'];

/** Every size, and the paints a few names draw. */
export default function MonogramTileExample(): JSX.Element {
  return (
    <ExampleRoot>
      <For each={SIZES}>
        {(size) => (
          <div class="box flex-row flex-wrap items-center gap-3">
            <For each={NAMES}>
              {([seed, name]) => (
                <MonogramTile name={name} seed={seed} size={size} />
              )}
            </For>
          </div>
        )}
      </For>
    </ExampleRoot>
  );
}
