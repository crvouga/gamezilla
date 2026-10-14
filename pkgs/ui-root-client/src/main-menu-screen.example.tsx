import { createSignal, type JSX } from 'solid-js';
import { Button } from './button';
import { MainMenuScreen } from './main-menu-screen';
import { ScreenExampleFrame } from './screen-example-frame';

export default function MainMenuScreenExample(): JSX.Element {
  const [game, setGame] = createSignal<string | null>(null);
  const [mode, setMode] = createSignal<string | null>(null);
  const back = (): void => {
    setMode(null);
    setGame(null);
  };
  return (
    <ScreenExampleFrame>
      <MainMenuScreen
        screenId="example-main-menu"
        title={game() ?? 'Choose a game'}
        subtitle={mode() ?? 'Choose how you want to play.'}
        items={
          game() === null
            ? ['Four in a row', 'Fleet', 'Three in a row'].map((title) => ({
                key: title,
                title,
                onClick: () => setGame(title),
              }))
            : [
                'Custom game',
                'Matchmaking',
                'Puzzles',
                'History',
                'Settings',
              ].map((title) => ({
                key: title,
                title,
                onClick: () => setMode(title),
              }))
        }
        footer={
          game() === null ? undefined : (
            <Button
              title="Choose another game"
              variant="outline"
              onClick={back}
            />
          )
        }
      />
    </ScreenExampleFrame>
  );
}
