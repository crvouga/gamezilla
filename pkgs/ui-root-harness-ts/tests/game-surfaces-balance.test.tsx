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
  test('a section draws its picture inside its own card, beside the body', () => {
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
    expect(section.contains(screen.getByTestId('preview'))).toBe(true);
    // The body and the picture share one row; the footer closes the card
    // under both.
    const preview = screen.getByTestId('preview');
    expect(preview.parentElement?.parentElement?.textContent).toContain(
      'avery'
    );
    expect(
      preview.parentElement?.parentElement?.contains(
        screen.getByRole('button', { name: 'Start game' })
      )
    ).toBe(false);
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
