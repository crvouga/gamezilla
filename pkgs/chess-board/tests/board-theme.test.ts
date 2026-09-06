import {
  defaultBoardTheme,
  mergeBoardTheme,
} from '@pkgs/chess-board/board-theme';
import type { BoardTheme } from '@pkgs/chess-board-core/types';
import { describe, expect, it } from 'vitest';

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
