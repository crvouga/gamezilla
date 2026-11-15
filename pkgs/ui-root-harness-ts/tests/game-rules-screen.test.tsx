/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameRulesScreen } from '@pkgs/ui-root-client-ts/game-rules-screen';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

function rules(width: number) {
  return render(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
      <GameRulesScreen
        screenId="game-how-to-play"
        eyebrow="How to play"
        title="Connect Four"
        motif="discs"
        subtitle="Drop a disc. Connect four."
        sections={[
          { key: 'goal', title: 'Goal', body: 'Line up four.' },
          { key: 'turn', title: 'Your turn', body: 'Choose a column.' },
        ]}
        actions={<Button title="Play" onClick={() => undefined} />}
      />
    </ThemeProvider>
  ));
}

describe('GameRulesScreen', () => {
  test.each([390, 1440])(
    'at %ipx the game names the screen and each rule is a numbered heading, in order',
    (width) => {
      const view = rules(width);
      expect(view.getByRole('heading', { level: 1 }).textContent).toContain(
        'Connect Four'
      );
      const parts = view.getAllByRole('listitem');
      expect(parts.map((part) => part.getAttribute('data-key'))).toEqual([
        'goal',
        'turn',
      ]);
      // The number is on the heading's line, hidden from its name.
      expect(
        view.getByRole('heading', { level: 2, name: 'Your turn' }).textContent
      ).toBe('2Your turn');
      expect(
        view.getByRole('heading', { level: 2, name: 'Goal' })
      ).toBeTruthy();
      view.unmount();
    }
  );

  test('what leads on from the rules comes after the last rule', () => {
    const view = rules(390);
    const play = view.getByRole('button', { name: 'Play' });
    const last = view.getAllByRole('listitem').at(-1);
    expect(
      last !== undefined &&
        (last.compareDocumentPosition(play) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0
    ).toBe(true);
    view.unmount();
  });
});

describe('GameRulesScreen parts', () => {
  test('many parts get a link each; a link takes the keyboard to its heading', () => {
    const keys = ['goal', 'turn', 'knight', 'castling', 'end'];
    const view = render(() => (
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameRulesScreen
          screenId="game-how-to-play"
          eyebrow="How to play"
          title="Chess"
          motif="checkered"
          partsLabel="Jump to a part"
          sections={keys.map((key) => ({ key, title: key, body: `${key}.` }))}
        />
      </ThemeProvider>
    ));
    const nav = view.getByRole('navigation', { name: 'Jump to a part' });
    const links = nav.querySelectorAll('button');
    expect(links).toHaveLength(5);
    // The part being read is marked, the first while none has scrolled by.
    expect(links[0]?.getAttribute('aria-current')).toBe('true');
    expect(nav.querySelectorAll('[aria-current="true"]')).toHaveLength(1);
    const castling = links[3];
    if (castling === undefined) throw new Error('No castling link');
    castling.click();
    expect(document.activeElement?.textContent).toBe('4castling');
    view.unmount();
  });

  test('a few parts read at a glance, with no links', () => {
    const view = rules(390);
    expect(view.queryByRole('navigation')).toBeNull();
    view.unmount();
  });
});
