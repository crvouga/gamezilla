import { describe, expect, it } from 'bun:test';
import {
  boardThemeToCssVars,
  defaultBoardTheme,
  mergeBoardTheme,
} from '@pkgs/chess-board/board-theme';
import type { BoardTheme } from '@pkgs/chess-board-core/types';

describe('mergeBoardTheme', () => {
  it('overrides square colors and keeps feedback keys', () => {
    const base = defaultBoardTheme('light');
    const override: Partial<BoardTheme> = {
      lightSquare: '#fff',
      feedback: { ...base.feedback, check: '#0f0' },
    };
    const merged = mergeBoardTheme(base, override);
    expect(merged.lightSquare).toBe('#fff');
    expect(merged.feedback.check).toBe('#0f0');
    expect(merged.feedback.cross).toBe(base.feedback.cross);
    expect(merged.promotion.surface).toBe('#fff');
  });
});

describe('boardThemeToCssVars', () => {
  it('maps theme colors to chess CSS custom properties', () => {
    const theme = defaultBoardTheme('light');
    const vars = boardThemeToCssVars(theme);
    expect(vars['--chess-sq-light']).toBe(theme.lightSquare);
    expect(vars['--chess-sq-dark']).toBe(theme.darkSquare);
    expect(vars['--chess-border']).toBe(theme.border);
    expect(vars['--chess-last-move']).toBe(theme.lastMove);
    expect(vars['--chess-selected']).toBe(theme.selected);
    expect(vars['--chess-check']).toBe(theme.check);
    expect(vars['--chess-legal-dot']).toBe(theme.legalMoveDot);
    expect(vars['--chess-legal-ring']).toBe(theme.legalMoveCaptureRing);
    expect(vars['--chess-premove']).toBe(theme.premove);
    expect(vars['--chess-hover']).toBe(theme.hover);
    // Only what the stylesheet reads.
    expect(Object.keys(vars).every((k) => k.startsWith('--chess-'))).toBe(true);
    expect(vars['--chess-feedback-check']).toBeUndefined();
  });
});
