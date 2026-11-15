/**
 * Story-only: a game's menu wired the way `GameMenu` wires it in a space
 * (this device's place, the bar's Back naming where it leads, the game's
 * name in the bar's trail), over fixture games whose copy matches the
 * games' own. Production never imports this module.
 */
import {
  DefineBackButton,
  GameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { useScreenPlace } from '@pkgs/turn-game-client-ts/use-screen-place';
import type { GameRulesSection } from '@pkgs/ui-root-client-ts/game-rules-screen';
import { type JSX, onMount } from 'solid-js';
import { GAME_MENU_PLACES } from './game-menu-places';
import {
  type GameMenuChoiceView,
  GameMenuScreenView,
  type GameMenuScreenViewProps,
} from './game-menu-screen-view';

/** A rule as a game declares it, already rendered. */
function rule(
  key: string,
  title: string,
  body: string,
  points?: readonly string[]
): GameRulesSection {
  return { key, title, body, points };
}

export const CONNECT_FOUR_RULES: readonly GameRulesSection[] = [
  rule(
    'goal',
    'Goal',
    'Line up four of your own: in a row, a column or a diagonal.'
  ),
  rule(
    'turn',
    'Your turn',
    'Red circles play first, then Yellow diamonds. Choose a column; your piece drops into its lowest empty place.'
  ),
  rule(
    'end',
    'The end',
    'Four in a line wins. A full board without four is a draw.'
  ),
];

export const HEARTS_RULES: readonly GameRulesSection[] = [
  rule(
    'goal',
    'Goal',
    'Take as few points as you can. Each heart you take costs a point and the queen of spades thirteen.'
  ),
  rule(
    'pass',
    'Pass three cards',
    "Four players each get thirteen cards. Before each deal's play, everyone secretly passes three cards: to the left, then right, then across, then not at all, and again."
  ),
  rule(
    'trick',
    'Play the tricks',
    'A trick is one card from each player, in turn. The first card played leads, and its suit is the suit led.',
    [
      'Whoever holds the two of clubs leads the first trick.',
      'Follow the suit led if you can.',
      'The highest card of the suit led takes the trick and leads the next.',
      'For example: clubs are led 2, 9, king, then a heart from someone with no clubs. The king takes the trick, heart and all.',
    ]
  ),
  rule(
    'holding',
    'Holding back hearts and the queen',
    "Hearts and the queen of spades can't be played on the first trick unless you hold nothing else. Hearts can't be led until one has been played, unless you hold only hearts."
  ),
  rule(
    'end',
    'Scoring and the end',
    'Take every heart and the queen and everyone else gets twenty-six instead. When a score reaches 100 at the end of a deal, the lowest score wins; tied lowest scores share the win.'
  ),
];

export const CHESS_RULES: readonly GameRulesSection[] = [
  rule(
    'goal',
    'Goal',
    'Checkmate the other king: attack it so that no move saves it.'
  ),
  rule(
    'turn',
    'Your turn',
    "White moves first, then the sides take turns moving one piece. Land on another's piece to take it; you may never leave your own king in check.",
    [
      '♚ King: one square in any direction.',
      '♛ Queen: any distance in a straight line or diagonal.',
      '♜ Rook: any distance in a straight line.',
      '♝ Bishop: any distance diagonally.',
      '♞ Knight: an L, two squares one way and one to the side, jumping over pieces.',
      '♟ Pawn: one square forward, or two from its start; it takes one square diagonally forward.',
    ]
  ),
  rule('special', 'Special moves', 'Three moves break the usual pattern.', [
    'Castling: the king moves two squares toward a rook, which jumps to its other side. Neither may have moved, and the king may not be in, pass through or land in check.',
    'Promotion: a pawn that reaches the last row becomes a queen, rook, bishop or knight.',
    'En passant: a pawn that just moved two squares may be taken as if it had moved one, on the next move only.',
  ]),
  rule(
    'end',
    'The end',
    'Checkmate wins. A side with no legal move that is not in check is stalemated, and the game is drawn.'
  ),
];

export const NUMBERLINK_RULES: readonly GameRulesSection[] = [
  rule(
    'goal',
    'Goal',
    'Join every pair of matching endpoints, and cover every cell unless the puzzle explicitly uses pairs-only coverage.'
  ),
  rule(
    'paths',
    'Paths',
    'Paths move horizontally or vertically. They never cross or overlap.'
  ),
];

/** The shared choices of a game named `name` for `players` players. */
export function sharedChoices(
  name: string,
  players = 2
): readonly GameMenuChoiceView[] {
  return [
    {
      screen: 'custom-game',
      title: 'Play with friends or bots',
      caption: 'Invite people in this space, or add bots',
    },
    players > 2
      ? {
          screen: 'multiplayer',
          title: 'Find players',
          caption: `Meet ${players - 1} other ${name} players`,
        }
      : {
          screen: 'multiplayer',
          title: 'Find an opponent',
          caption: `Meet another ${name} player`,
        },
    {
      screen: 'history',
      title: 'History and stats',
      caption: 'Your games, wins and draws',
    },
  ];
}

/** Chess: the shared ways to play, its puzzles, then the looks back. */
export const CHESS_CHOICES: readonly GameMenuChoiceView[] = [
  ...sharedChoices('Chess').slice(0, 2),
  {
    screen: 'puzzle',
    title: 'Puzzle',
    caption: 'Solve rated puzzles and climb the ladder',
  },
  ...sharedChoices('Chess').slice(2),
  {
    screen: 'stats',
    title: 'Puzzle stats',
    caption: 'Rating trend and game log',
  },
  {
    screen: 'settings',
    title: 'Manage puzzles',
    caption: 'Load puzzles from Lichess',
  },
];

/** A story's menu: the screen's props and where Back leaves the menu to. */
export type GameMenuStoryProps = GameMenuScreenViewProps & {
  readonly onBackToGames: () => void;
};

/**
 * The menu as `GameMenu` composes it: Back says "Games" on the menu and
 * the game's name behind it, and walks this device's place back first.
 * The story's `place` is where it opens.
 */
export function GameMenuStory(props: GameMenuStoryProps): JSX.Element {
  const nav = useScreenPlace(GAME_MENU_PLACES, () => 'open' as const);
  onMount(() => {
    if (props.place.screen !== 'menu') nav.open(props.place);
  });
  return (
    <GameChoicesName name={props.title}>
      <DefineBackButton
        onPress={() => {
          if (!nav.back()) props.onBackToGames();
        }}
        label={nav.place().screen === 'menu' ? 'Games' : props.title}
      />
      <GameMenuScreenView
        {...props}
        place={nav.place()}
        onOpen={(place) => {
          props.onOpen(place);
          nav.open(place);
        }}
      />
    </GameChoicesName>
  );
}
