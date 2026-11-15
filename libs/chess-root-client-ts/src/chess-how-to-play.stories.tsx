import { GameMenuStory } from '@libs/game-menu-client-ts/game-menu-story.example';
import type { GameRulesSection } from '@pkgs/ui-root-client-ts/game-rules-screen';
import { Dynamic } from 'solid-js/web';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CHESS_RULES } from './chess-game-client';

/** Chess's own rules as the game's menu draws them, examples included. */
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

const meta = {
  id: 'screens-games-chess-how-to-play',
  title: 'Screens/Games/Chess/How to play',
  component: GameMenuStory,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    docs: {
      description: {
        component:
          "How to play Chess, as a game's menu draws it in a space: Chess's own rules part by part, the knight, castling and en passant pictured on small still boards, then the way to play.",
      },
    },
    controls: { exclude: ['choices', 'subtitle', 'instructions', 'place'] },
  },
  render: (args) => <GameMenuStory {...args} instructions={chessRules()} />,
  args: {
    title: 'Chess',
    tile: 'checkered',
    subtitle: 'Checkmate the king. Every piece moves its own way.',
    instructions: [],
    choices: [
      {
        screen: 'custom-game',
        title: 'Play with friends or bots',
        caption: 'Invite people in this space, or add bots',
      },
    ],
    onChoose: fn(),
    place: { screen: 'how-to-play' },
    onOpen: fn(),
    onBackToGames: fn(),
  },
} satisfies Meta<typeof GameMenuStory>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Chess's rules, from the game's own client: every piece's move, the
 * knight, castling and en passant pictured on small still boards.
 */
export const Rules: Story = {};
