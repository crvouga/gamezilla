import {
  defineGameClient,
  type GameClientPresentation,
} from '@libs/game-menu-client-ts/game-client';
import {
  wordTiles3GameShared,
  wordTiles4GameShared,
  wordTilesGameShared,
} from '@libs/word-tiles-shared-ts/word-tiles-game';
import { ENABLE_LEXICON } from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import {
  RULESET,
  type WordTilesSeatCount,
} from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { JSX } from 'solid-js';
import { WordTilesBoard } from './word-tiles-board';
import { wordTilesFrame } from './word-tiles-frame';
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

const presentation = (seats: WordTilesSeatCount): GameClientPresentation => ({
  canFlip: false,
  name: () => t`Word Tiles`,
  Board: WordTilesBoard,
  sideLabel,
  frame: wordTilesFrame(seats),
  endingDescription: (reason) =>
    reason === 'rack emptied'
      ? t`A player used their last tile with the bag empty. Everyone else's tiles count against them and go to that player.`
      : reason === 'six scoreless turns'
        ? t`Six turns in a row scored nothing. Each player's remaining tiles count against them.`
        : undefined,
  endingLabel: (reason) =>
    reason === 'rack emptied' ? t`rack emptied` : t`six scoreless turns`,
  timeoutDrawDescription: (side) => {
    const name = sideLabel(side);
    return t`${name} ran out of time. The game is a draw.`;
  },
});

function Instructions(): JSX.Element {
  const lexicon = ENABLE_LEXICON.key;
  const ruleset = RULESET.id;
  return (
    <Trans>
      Take turns placing tiles from your seven-tile rack in one row or column to
      form words, joined to the tiles already on the 15 × 15 board; the first
      word covers the centre star. Every word you form or extend must be in the
      word list, and each is scored: letter squares multiply the new tile under
      them, word squares the whole word, and using all seven tiles earns 50
      more. A blank plays any letter for no points. Instead of placing you may
      pass, or exchange tiles while the bag holds at least seven. The game ends
      when someone uses their last tile with the bag empty — the others'
      remaining tiles count against them and go to that player — or after six
      scoreless turns in a row, when everyone's remaining tiles count against
      them. The highest score wins; tied leaders share the win. Resigning or
      running out of time follows the table's rules: with two players the other
      wins, with more the game is drawn. Word list: {lexicon} (ENABLE, public
      domain, words of 2 to 15 letters). Rules: {ruleset}.
    </Trans>
  );
}

export const wordTilesGameClient = defineGameClient({
  shared: wordTilesGameShared,
  title: 'Word Tiles',
  caption: 'Two players. Build crossing words for points.',
  subtitle: () => (
    <Trans>Place letter tiles, cross words, score squares.</Trans>
  ),
  instructions: () => <Instructions />,
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
  caption: 'Three players. Build crossing words for points.',
  subtitle: () => (
    <Trans>Three racks, one board, the highest score wins.</Trans>
  ),
  instructions: () => <Instructions />,
  presentation: presentation(3),
});

export const wordTiles4GameClient = defineGameClient({
  shared: wordTiles4GameShared,
  title: 'Word Tiles for four',
  caption: 'Four players. Build crossing words for points.',
  subtitle: () => <Trans>Four racks, one board, the highest score wins.</Trans>,
  instructions: () => <Instructions />,
  presentation: presentation(4),
});
