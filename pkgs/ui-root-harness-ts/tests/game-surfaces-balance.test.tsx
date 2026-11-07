/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { PuzzleScreen } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

const UI_SRC = join(import.meta.dirname, '../../ui-root-client-ts/src');

/** The body of the first rule whose selector is exactly `selector`. */
function rule(file: string, selector: string): string {
  const css = readFileSync(join(UI_SRC, file), 'utf8');
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

describe('game surfaces', () => {
  // regression: setup-board-preview-floats-beside-card — wide, the 200px
  // board preview floated top-right of the page, unrelated to the Players
  // card beside it.
  // regression: setup-preview-jammed-in-card — the preview then sat inside
  // the Players card as a third "player" column (and under its heading on a
  // phone). It is a card of its own, paired with the section: first in the
  // pair (above it on a phone), beside it and as tall as it when wide.
  test('a section pairs its picture in a card of its own, before the section', () => {
    renderUi(() => (
      <GameSection
        title="Players"
        media={<div data-testid="preview">board</div>}
        footer={<button type="button">Start game</button>}
      >
        <p>avery</p>
      </GameSection>
    ));
    const section = screen.getByRole('region', { name: 'Players' });
    expect(section.getAttribute('data-section-media')).toBe('true');
    const preview = screen.getByTestId('preview');
    // Not inside the section: never read as one more item of its body.
    expect(section.contains(preview)).toBe(false);
    const pair = section.parentElement;
    expect(pair?.getAttribute('data-component')).toBe('GameSectionPair');
    // The picture's card leads the pair; the section and its footer follow.
    expect(pair?.firstElementChild?.contains(preview)).toBe(true);
    expect(pair?.lastElementChild).toBe(section);
    expect(
      section.contains(screen.getByRole('button', { name: 'Start game' }))
    ).toBe(true);
    // Wide, the two cards share one row at one height.
    const css = readFileSync(
      join(UI_SRC, 'game-section/game-section-media.module.css'),
      'utf8'
    );
    expect(css).toMatch(
      /@container game-section \(min-width: 40rem\)\s*\{\s*\.sectionPair\s*\{[^}]*align-items: stretch/
    );
    // regression: setup-pair-measures-itself — the pair was its own size
    // container, which a container query cannot measure, so wide it never
    // took its two columns and the picture's card shrank to its content.
    // The room around the pair is the container; the pair is the grid.
    expect(pair?.parentElement?.getAttribute('data-section-media')).toBe(
      'true'
    );
    const room = css.slice(css.indexOf('.sectionRoom {'));
    expect(room.slice(0, room.indexOf('}'))).toContain(
      'container: game-section / inline-size'
    );
    const grid = css.slice(css.indexOf('.sectionPair {'));
    expect(grid.slice(0, grid.indexOf('}'))).not.toContain('container');
  });

  // regression: setup-phone-preview-leads-players — on a phone the board
  // preview was a 96px thumbnail in a card about 140px tall ahead of the
  // Players card, so the preview, not the players, led the setup. It is a
  // slim row now: a 48px thumbnail beside its label.
  test("a phone's setup picture is a slim row, the thumbnail beside its label", () => {
    const media = rule(
      'game-section/game-section-media.module.css',
      '.sectionMedia'
    );
    // regression: wide-setup-unbalanced — wide, the card beside the players
    // holds the preview and how the game is played, spaced apart.
    const pairCss = readFileSync(
      join(UI_SRC, 'game-section/game-section-media.module.css'),
      'utf8'
    );
    const wide = pairCss.slice(
      pairCss.indexOf('@container game-section (min-width: 40rem)')
    );
    expect(wide).toMatch(/\.sectionMedia \{[^}]*gap: var\(--ui-space-4\);/);
    expect(media).toContain('--game-board-preview-measure: 48px');
    const pair = readFileSync(
      join(UI_SRC, 'game-section/game-section-media.module.css'),
      'utf8'
    );
    expect(pair).toMatch(
      /@container game-section \(max-width: 39\.99rem\)\s*\{\s*\.sectionPair \.sectionMedia \[data-preview="true"\]\s*\{[^}]*flex-direction: row/
    );
  });

  // regression: phone-three-players-two-rows — on a phone three players'
  // chips wrapped as two and one, the third alone on a second row, pushing
  // a Light Cycles arena down. Three players make one row of three chips.
  // regression: light-cycles-phone-chips-tall — those chips then stacked
  // avatar over name over figures over "You", about 130px tall, shrinking
  // the arena. Each is its name over one line of its avatar, a size
  // smaller, swatch and figure.
  // regression: light-cycles-rider-cards-uneven — the person's own chip
  // then wrapped its "You" under its figure, so its avatar dropped below
  // its name while the other two chips kept one line. Every chip is the
  // same name and facts rows, with no avatar to push them apart.
  // Long facts wrap within their chip; browser checks cover their bounds.
  test('three players on a phone share one row of identical short chips', () => {
    const css = readFileSync(
      join(UI_SRC, 'game-player-rail/game-player-rail.module.css'),
      'utf8'
    );
    const phone = css.slice(
      css.indexOf('@container game-column (max-width: 879px)')
    );
    expect(phone).toMatch(
      /\.playerRail:has\(> :nth-child\(3\):last-child\) \{\s*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\);/
    );
    const frame = phone.slice(phone.indexOf('.chipFrame {'));
    expect(frame.slice(0, frame.indexOf('}'))).toMatch(
      /display: grid;\s*grid-template-columns: minmax\(0, 1fr\);\s*grid-template-rows: auto auto;/
    );
    expect(phone).toMatch(/\.chipText \{\s*display: contents;/);
    expect(phone).toMatch(/\.chipAvatar \{\s*display: none;/);
    const facts = phone.slice(phone.indexOf('.chipFacts {'));
    expect(facts.slice(0, facts.indexOf('}'))).toMatch(
      /width: 100%;[\s\S]*flex-wrap: wrap;/
    );
  });

  // regression: battleship-phone-targets-small — on a phone each of the
  // ten targets in a row was about 30px, the grid's gaps, padding and label
  // column taking the rest. They are slim now, each target about 32px.
  test("a phone's Battleship grid gives its room to the targets", () => {
    const css = readFileSync(
      join(UI_SRC, 'cell-grid-board/cell-grid-board.module.css'),
      'utf8'
    );
    const phone = css.slice(
      css.indexOf('@container game-column (max-width: 879px)')
    );
    const grid = phone.slice(0, phone.indexOf('}'));
    expect(grid).toContain('[data-board-theme="battleship"]');
    expect(grid).toContain('minmax(1rem, 0.5fr)');
    expect(grid).toContain('gap: 1px');
    expect(grid).toContain('padding: var(--ui-space-1)');
  });

  test('a section with no picture keeps its plain body', () => {
    renderUi(() => (
      <GameSection title="Players">
        <p>avery</p>
      </GameSection>
    ));
    const section = screen.getByRole('region', { name: 'Players' });
    expect(section.getAttribute('data-section-media')).toBe('false');
  });

  // regression: game-record-panel-stretched-empty — wide, the record panel
  // ran the board's height: three moves at its top, about 300px of nothing,
  // then the steps and the game's commands at its foot.
  // regression: game-rail-commands-detached — then the commands became a
  // card pinned to the board's foot, about 200px under the record.
  test("the game's commands close the record's own card, and the rail is as tall as what it holds", () => {
    renderUi(() => (
      <GameSection
        title="Game record"
        footer={
          <GameActions>
            <button type="button">Offer draw</button>
          </GameActions>
        }
      >
        <p>1 e4 e5</p>
      </GameSection>
    ));
    const section = screen.getByRole('region', { name: 'Game record' });
    expect(section.contains(screen.getByRole('button'))).toBe(true);
    const rail = rule(
      'game-ui.module.css',
      '  .layout[data-has-stage="true"][data-has-aside="true"] > .rail'
    );
    expect(rail).toMatch(/align-self:\s*start;/);
    expect(
      readFileSync(join(UI_SRC, 'game-ui.module.css'), 'utf8')
    ).not.toContain('.railFoot');
  });

  // regression: rating-track-invisible-dark — on a dark card the rating's
  // progress track was the sunken well, almost the card's own color.
  test('a progress track is the line tone, never the sunken well', () => {
    renderUi(() => <ProgressBar size="sm" progress={7 / 12} />);
    const track = screen.getByRole('progressbar');
    expect(track.className).toMatch(/\bbg-border\b/);
    expect(track.className).not.toMatch(/\bbg-surface-muted\b/);
  });

  // regression: setup-change-player-truncated-on-phone — a phone seat row
  // said only "Change" beside the name, and spelling it out cut "Bot
  // (medium)" short.
  test("a phone seat's toggle sits under the name, beside the seat's own controls", () => {
    renderUi(
      () => (
        <GamePlayerBar
          density="compact"
          name="Bot (medium)"
          options={<p>Choices</p>}
          optionsLabel="Change player"
          optionsPlacement="below"
          optionsDataSet={{ testid: 'toggle' }}
        >
          <button type="button">I'm not ready</button>
        </GamePlayerBar>
      ),
      { width: 390 }
    );
    const toggle = screen.getByTestId('toggle');
    expect(toggle.textContent).toBe('Change player');
    const below = toggle.parentElement;
    expect(below?.contains(screen.getByText("I'm not ready"))).toBe(true);
    expect(below?.contains(screen.getByText('Bot (medium)'))).toBe(false);
  });

  test("a wide seat's toggle stays at the row's far edge", () => {
    renderUi(() => (
      <GamePlayerBar
        density="compact"
        name="Bot (medium)"
        options={<p>Choices</p>}
        optionsLabel="Change player"
        optionsDataSet={{ testid: 'toggle' }}
      >
        <button type="button">I'm not ready</button>
      </GamePlayerBar>
    ));
    const row = screen.getByTestId('toggle').parentElement;
    expect(row?.contains(screen.getByText('Bot (medium)'))).toBe(true);
    expect(row?.contains(screen.getByText("I'm not ready"))).toBe(false);
  });

  // regression: puzzle-run-chips-break-margin — the run-so-far pills sat
  // under the actions 12–16px outside the page's inset, and a phone had no
  // visible title naming the mode.
  test("a puzzle's title shows on every size, with its facts on its line", () => {
    for (const width of [390, 1440]) {
      const view = renderUi(
        () => (
          <PuzzleScreen
            screenId="puzzle"
            title="Puzzles"
            facts={<span data-testid="run">3 in a row</span>}
            actions={<button type="button">Hint</button>}
          >
            <div />
          </PuzzleScreen>
        ),
        { width }
      );
      const title = view.container.querySelector(
        '[data-component="PuzzleTitle"]'
      );
      expect(title?.textContent).toContain('Puzzles');
      expect(title?.contains(view.getByTestId('run'))).toBe(true);
      view.unmount();
    }
    // Visible on a phone: no clip, at the page's one inset.
    const phone = rule('screen-layouts.module.css', '.title');
    expect(phone).not.toMatch(/clip-path/);
    expect(phone).toMatch(/padding-inline:\s*var\(--ui-space-lg\);/);
  });

  // regression: rating-progress-stops-short — a provisional rating's bar
  // stopped at 240px, short of the card it sat in.
  test("a stat's progress bar spans the stat", () => {
    const bar = rule('game-stat/game-stat.module.css', '.statProgress');
    expect(bar).not.toMatch(/max-width/);
    expect(bar).toMatch(/width:\s*100%;/);
  });

  // regression: game-rail-short-of-edge — beside a wide board the rail kept
  // a fixed 376px, so it ended wherever the window's height left the board:
  // Battleship's at x=1203, Chess's at 1300, Light Cycles' at 1320, under a
  // header running to 1320, with about 380px of empty page under it. The
  // rail takes what the board leaves of the column, so every rail ends at
  // the column's edge, and a long game's moves grow to about the board's
  // height before they scroll.
  test("the rail beside a wide board runs to the column's edge and its moves grow beside the board", () => {
    const css = readFileSync(join(UI_SRC, 'game-ui.module.css'), 'utf8');
    const wide = css.slice(
      css.indexOf('@container game-column (min-width: 880px)')
    );
    const head =
      '.layout[data-has-stage="true"][data-has-aside="true"],\n  .layout[data-has-stage="true"][data-has-setup="true"] {\n';
    const grids = wide
      .split(head)
      .slice(1)
      .map((body) => body.slice(0, body.indexOf('}')));
    const columns = grids.find((body) =>
      body.includes('grid-template-columns')
    );
    expect(columns).toMatch(
      /grid-template-columns:\s*minmax\(0, var\(--game-board-measure\)\)\s*minmax\(280px, 1fr\);/
    );
    const table = wide.slice(
      wide.indexOf('> .rail\n    [data-layout="table"] {')
    );
    expect(table.slice(0, table.indexOf('}'))).toMatch(
      /max-height:\s*max\(320px, calc\(var\(--game-board-measure\) - 120px\)\);/
    );
  });

  // regression: light-cycles-you-badge-wraps — on a phone the three riders'
  // chips were as tall as their own lines, so the person's, with "You" on
  // a line of its own, stood taller than the rest and its name sat higher.
  // Every chip of a row takes the row's height and a stacked chip's lines
  // start at its top, so avatars, names and figures line up.
  test("a rail's chips share their row's height, a stacked chip's lines from its top", () => {
    const source = readFileSync(
      join(UI_SRC, 'game-player-rail/index.tsx'),
      'utf8'
    );
    const frame = source.slice(source.indexOf('const CHIP_FRAME ='));
    expect(frame.slice(0, frame.indexOf(';'))).toMatch(/\bflex-1'/);
    expect(source).toMatch(/class="box min-w-0 flex-1"\s*role=/);
    expect(
      rule(
        'game-player-rail/game-player-rail.module.css',
        '  .playerRail:has(> :nth-child(3):last-child) .chipFrame'
      )
    ).toMatch(/align-content:\s*start;/);
  });

  // regression: setup-players-card-stretched — wide, the board preview's
  // card (a 176px board, its label and how the game is played) stood taller
  // than the Players card, so the pair stretched the Players card about
  // 54px past "Ready to start". The wide thumbnail is 120px, so the picture's
  // card is no taller than the section.
  // regression: setup-seat-cards-uneven — the bot's seat card stood 4px
  // shorter than the host's beside it: its facts line held no "Host" tag.
  // A compact seat's facts line is a tag's height either way.
  test("a wide setup's preview card is no taller than its players, and seat rows stay level", () => {
    const css = readFileSync(
      join(UI_SRC, 'game-section/game-section-media.module.css'),
      'utf8'
    );
    const wide = css.slice(
      css.indexOf('@container game-section (min-width: 40rem)')
    );
    const media = wide.slice(wide.indexOf('.sectionMedia {'));
    // regression: setup-preview-tiny — the 120px board then read as a
    // speck beside "How to play".
    // regression: setup-desktop-top-strip — at 160px in a 17rem card the
    // pair was a 290px strip across the top of the page. The picture's
    // card is now an equal column, its board 240px, about the height of
    // two seats, their title and Start, so the two cards end level.
    expect(media.slice(0, media.indexOf('}'))).toMatch(
      /--game-board-preview-measure:\s*240px;/
    );
    expect(wide).toMatch(
      /\.sectionPair \{\s*grid-template-columns: minmax\(0, 1fr\) minmax\(0, 1fr\);/
    );
    // Beside a taller picture, Start stays at the Players card's end.
    expect(wide).toMatch(/\.sectionPair \.sectionFoot \{\s*margin-top: auto;/);
    expect(
      rule('game-ui.module.css', '.player[data-density="compact"] .playerTags')
    ).toMatch(/min-height:\s*var\(--ui-space-6\);/);
    // A phone's preview row: the stage is as wide as its thumbnail, so the
    // line beside it (how the game is played) has the rest of the row.
    const phone = rule(
      'game-section/game-section-media.module.css',
      '  .sectionPair .sectionMedia [data-preview="true"]'
    );
    expect(phone).toMatch(/flex:\s*0 0 auto;/);
    expect(phone).toMatch(/width:\s*auto;/);
  });

  // regression: matchmaking-columns-misaligned — wide, the search card's
  // "New game" title ran above both halves, so "Your ratings" started a
  // line lower, level with the "Rated · Untimed" line instead of the title.
  // The card is one grid: its title heads the search's half and the
  // ratings' half starts level with it.
  test("a split setup card's two halves start on one line", () => {
    const css = readFileSync(
      join(UI_SRC, 'game-setup-panel/game-setup-panel.module.css'),
      'utf8'
    );
    const wide = css.slice(
      css.lastIndexOf('@container game-column (min-width: 880px)')
    );
    const body = (head: string): string => {
      const start = wide.indexOf(`${head} {`);
      expect(start).toBeGreaterThan(-1);
      return wide.slice(start, wide.indexOf('}', start));
    };
    expect(body('section:has(> .setupSplit) > :first-child')).toMatch(
      /grid-row:\s*1;/
    );
    expect(body('section > .setupSplit')).toMatch(/display:\s*contents;/);
    expect(body('section > .setupSplit > .setupAside')).toMatch(
      /grid-row:\s*1 \/ span 2;/
    );
  });
});
