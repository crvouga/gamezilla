/** @jsxImportSource solid-js */
/** A game's menu says what the game is once. */
import { expect, test } from 'bun:test';
import { GameMenuScreenView } from '@libs/game-menu-client-ts/game-menu-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

function menu(width: number, instructions: string | undefined) {
  return renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <GameMenuScreenView
        title="Connect Four"
        tile="discs"
        subtitle="Drop discs and line up four"
        instructions={instructions}
        choices={[
          {
            screen: 'custom-games',
            title: 'Play with friends',
            caption: 'With the people in this space, or bots',
          },
        ]}
        onChoose={() => undefined}
      />
    </ThemeProvider>
  ));
}

const RULES =
  'Take turns dropping a disc into a column. Four in a row, column or diagonal wins.';

// regression: game-menu-tagline-repeats-rules — under Connect Four's name
// the menu said "Drop discs and line up four" and then "Take turns
// dropping a disc into a column. Four in a row, column or diagonal wins.",
// the same instruction twice. With how to play, the tagline is left out;
// a game without instructions keeps it.
test.each([390, 1440])(
  'at %ipx the menu says how to play once, without the tagline beside it',
  (width) => {
    const ruled = menu(width, RULES);
    expect(ruled.getByText(RULES)).toBeTruthy();
    expect(ruled.queryByText('Drop discs and line up four')).toBeNull();
    ruled.unmount();
    const plain = menu(width, undefined);
    expect(plain.getByText('Drop discs and line up four')).toBeTruthy();
    plain.unmount();
  }
);
