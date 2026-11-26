import {
  defineGameClient,
  type GameClientPresentation,
} from '@libs/game-menu-client-ts/game-client';
import {
  wordTiles3GameShared,
  wordTiles4GameShared,
  wordTilesGameShared,
} from '@libs/word-tiles-shared-ts/word-tiles-game';
import { winningSeats } from '@libs/word-tiles-shared-ts/word-tiles-play';
import { decodePosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import type { WordTilesSeatCount } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { WordTilesBoard } from './word-tiles-board';
import { wordTilesFrame } from './word-tiles-frame';
import { wordTilesLesson } from './word-tiles-lesson';
import { seatName } from './word-tiles-panels';
import {
  initialWordTilesPuzzle,
  WordTilesPuzzleEditor,
} from './word-tiles-puzzle-editor';
import {
  WordTilesPuzzlePlayer,
  WordTilesPuzzlePreview,
  wordTilesPuzzleStatus,
} from './word-tiles-puzzle-player';

function sideLabel(side: GameSide): string {
  return seatName(['white', 'black', 'red', 'blue'].indexOf(side));
}

/** How a shared top score drew the game, by how play ended. */
function sharedLead(position: string): string | undefined {
  const decoded = decodePosition(position);
  if (decoded === null || winningSeats(decoded).length < 2) return undefined;
  return decoded.ended === 'out'
    ? t`A player used their last tile with the bag empty, and the top score was shared.`
    : t`Six turns in a row scored nothing, and the top score was shared.`;
}

const presentation = (seats: WordTilesSeatCount): GameClientPresentation => ({
  canFlip: false,
  name: () => t`Word Tiles`,
  goal: () => t`Build words on the board. The highest score wins.`,
  Board: WordTilesBoard,
  sideLabel,
  frame: wordTilesFrame(seats),
  endingDescription: (reason) =>
    reason === 'rack emptied'
      ? t`A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.`
      : reason === 'six scoreless turns'
        ? t`Six turns in a row scored nothing. Each player's remaining tiles count against them.`
        : undefined,
  rulesDrawDescription: sharedLead,
  endingLabel: (reason) =>
    reason === 'rack emptied' ? t`rack emptied` : t`six scoreless turns`,
  timeoutDrawDescription: (side) => {
    const name = sideLabel(side);
    return t`${name} ran out of time. The game is a draw.`;
  },
});

export const wordTilesGameClient = defineGameClient({
  shared: wordTilesGameShared,
  title: 'Word Tiles',
  mode: { game: 'Word Tiles', name: '2 players' },
  caption: 'Two players. Build crossing words for points.',
  tile: 'letters',
  subtitle: () => (
    <Trans>Place letter tiles, cross words, score squares.</Trans>
  ),
  lesson: wordTilesLesson,
  presentation: presentation(2),
  puzzleContent: {
    Player: WordTilesPuzzlePlayer,
    Preview: WordTilesPuzzlePreview,
    frame: {
      stats: { target: () => t`Target`, score: () => t`Score` },
      turnStatus: wordTilesPuzzleStatus,
    },
    authoring: {
      Editor: WordTilesPuzzleEditor,
      initialDefinition: initialWordTilesPuzzle,
    },
  },
});

export const wordTiles3GameClient = defineGameClient({
  shared: wordTiles3GameShared,
  title: 'Word Tiles for three',
  mode: { game: 'Word Tiles', name: '3 players' },
  caption: 'Three players. Build crossing words for points.',
  tile: 'letters',
  subtitle: () => (
    <Trans>Three racks, one board, the highest score wins.</Trans>
  ),
  lesson: wordTilesLesson,
  presentation: presentation(3),
});

export const wordTiles4GameClient = defineGameClient({
  shared: wordTiles4GameShared,
  title: 'Word Tiles for four',
  mode: { game: 'Word Tiles', name: '4 players' },
  caption: 'Four players. Build crossing words for points.',
  tile: 'letters',
  subtitle: () => <Trans>Four racks, one board, the highest score wins.</Trans>,
  lesson: wordTilesLesson,
  presentation: presentation(4),
});
