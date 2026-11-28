import type { JSX } from '@solidjs/web';
import { For } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { GAME_TILE_MOTIFS, GameTile, GameTitleLockup } from './index';

/** Every motif at row, name and card-face size, and the title lockup a game's menu opens with. */
export default function GameTileExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-row flex-wrap gap-3">
        <For each={GAME_TILE_MOTIFS}>
          {(motif) => <GameTile motif={motif} dataSet={{ motif }} />}
        </For>
      </div>
      <div class="box flex-row flex-wrap gap-3">
        <For each={GAME_TILE_MOTIFS}>
          {(motif) => <GameTile motif={motif} size="lg" />}
        </For>
      </div>
      <div class="box flex-row flex-wrap gap-3">
        <For each={GAME_TILE_MOTIFS}>
          {(motif) => (
            <div class="box w-40 h-24 overflow-hidden rounded-card">
              <GameTile motif={motif} size="cover" />
            </div>
          )}
        </For>
      </div>
      <h1 class="text textTitle">
        <GameTitleLockup tile={<GameTile motif="discs" size="lg" />}>
          Drop four
        </GameTitleLockup>
      </h1>
    </ExampleRoot>
  );
}
