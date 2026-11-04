import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { GAME_TILE_MOTIFS, GameTile, GameTitleLockup } from './index';

/** Every motif at both sizes, and the title lockup a game's menu opens with. */
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
      <h1 class="text textTitle">
        <GameTitleLockup tile={<GameTile motif="discs" size="lg" />}>
          Drop four
        </GameTitleLockup>
      </h1>
    </ExampleRoot>
  );
}
