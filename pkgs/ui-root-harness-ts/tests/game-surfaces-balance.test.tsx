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
});
