import { Button } from '@pkgs/ui-root-client-ts/button';
import { MainMenuScreen } from '@pkgs/ui-root-client-ts/main-menu-screen';
import { createSignal, type JSX } from 'solid-js';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';

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
            ? [
                ...['Four in a row', 'Fleet', 'Three in a row'].map(
                  (title) => ({
                    key: title,
                    title,
                    caption: 'Two players',
                    onClick: () => setGame(title),
                  })
                ),
                {
                  key: 'coming-soon',
                  title: 'Coming soon',
                  caption: 'Soon',
                  disabled: true,
                  onClick: () => undefined,
                },
              ]
            : [
                'Custom game',
                'Matchmaking',
                'Puzzles',
                'History',
                'Settings',
              ].map((title) => ({
                key: title,
                title,
                selected: mode() === title,
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
