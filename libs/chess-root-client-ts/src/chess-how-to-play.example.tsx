/**
 * Story-only: how to play Chess as the game's menu draws it in a space,
 * fed with Chess's own rules. Production never imports this module.
 */
import {
  GameMenuStory,
  type GameMenuStoryProps,
} from '@libs/game-menu-client-ts/game-menu-story.example';
import type { GameRulesSection } from '@pkgs/ui-root-client-ts/game-rules-screen';
import type { JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { CHESS_RULES } from './chess-game-client';

/** Chess's rules as the game's menu draws them, examples included. */
function chessRules(): readonly GameRulesSection[] {
  return CHESS_RULES.map((rule) => ({
    key: rule.key,
    title: <Dynamic component={rule.title} />,
    body: <Dynamic component={rule.body} />,
    points: rule.points?.map((point) => <Dynamic component={point} />),
    examples: rule.examples?.map((example) => ({
      key: example.key,
      figure: <Dynamic component={example.Figure} />,
      caption: <Dynamic component={example.caption} />,
    })),
  }));
}

/**
 * How to play Chess in a space: Chess's own rules part by part, every
 * piece's move listed, the knight, castling and en passant pictured on
 * small still boards, then the way to play and back to every way to play.
 */
export function ChessHowToPlay(
  props: Omit<GameMenuStoryProps, 'instructions'>
): JSX.Element {
  return <GameMenuStory {...props} instructions={chessRules()} />;
}
