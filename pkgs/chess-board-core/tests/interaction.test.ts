import { describe, expect, test } from 'bun:test';
import { chessGameRules } from '@pkgs/chess-board-core/board-rules';
import { ChessGame } from '@pkgs/chess-board-core/game';
import {
  BoardInteraction,
  type BoardInteractionHooks,
} from '@pkgs/chess-board-core/interaction';

function setup(fen?: string, interactive = true) {
  const events: string[] = [];
  const hooks: BoardInteractionHooks = {
    onApplied: (r) => events.push(`applied:${r.move.from}${r.move.to}`),
    onIllegal: (from, to) => events.push(`illegal:${from}${to}`),
    onSelect: (sq) => events.push(`select:${sq}`),
    onPromotionCancel: () => events.push('promotion-cancel'),
  };
  const game = new ChessGame(fen);
  const interaction = new BoardInteraction(
    chessGameRules(game),
    hooks,
    interactive
  );
  return { game, interaction, events };
}

describe('BoardInteraction tap flow', () => {
  test('selects own piece, exposes legal targets, deselects on second tap', () => {
    const { interaction, events } = setup();
    let notified = 0;
    interaction.subscribe(() => notified++);

    interaction.tap('e2');
    expect(interaction.getSnapshot().selected).toBe('e2');
    expect([...interaction.getSnapshot().legalTargets].sort()).toEqual([
      'e3',
      'e4',
    ]);
    expect(events).toEqual(['select:e2']);

    interaction.tap('e2');
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(interaction.getSnapshot().legalTargets).toEqual([]);
    expect(notified).toBe(2);
  });

  test('ignores taps on opponent pieces and empty squares when nothing is selected', () => {
    const { interaction, events } = setup();
    interaction.tap('e7');
    interaction.tap('e4');
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(events).toEqual([]);
  });

  test('second tap on a target applies the move and clears selection', () => {
    const { game, interaction, events } = setup();
    interaction.tap('e2');
    interaction.tap('e4');
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(game.getSnapshot().lastMove?.to).toBe('e4');
    expect(game.getSnapshot().turn).toBe('b');
    expect(events).toEqual(['select:e2', 'applied:e2e4']);
  });

  test('illegal target reports onIllegal and leaves the game untouched', () => {
    const { game, interaction, events } = setup();
    interaction.tap('e2');
    interaction.tap('e5');
    expect(game.getSnapshot().lastMove).toBeNull();
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(events).toEqual(['select:e2', 'illegal:e2e5']);
  });

  test('non-interactive boards ignore taps and drags', () => {
    const { interaction } = setup(undefined, false);
    interaction.tap('e2');
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(interaction.beginDrag('e2')).toBe(false);
    interaction.setInteractive(true);
    expect(interaction.beginDrag('e2')).toBe(true);
    interaction.setInteractive(false);
    expect(interaction.getSnapshot().dragFrom).toBeNull();
  });
});

describe('BoardInteraction drag flow', () => {
  test('beginDrag only for the mover; drop applies and clears dragFrom', () => {
    const { interaction, events } = setup();
    expect(interaction.beginDrag('e7')).toBe(false);
    expect(interaction.beginDrag('g1')).toBe(true);
    expect(interaction.getSnapshot().dragFrom).toBe('g1');
    expect([...interaction.getSnapshot().legalTargets].sort()).toEqual([
      'f3',
      'h3',
    ]);

    const outcome = interaction.drop('g1', 'f3');
    expect(outcome.kind).toBe('applied');
    expect(interaction.getSnapshot().dragFrom).toBeNull();
    expect(events).toEqual(['applied:g1f3']);
  });

  test('cancelDrag clears without touching the game', () => {
    const { game, interaction } = setup();
    interaction.beginDrag('d2');
    interaction.cancelDrag();
    expect(interaction.getSnapshot().dragFrom).toBeNull();
    expect(game.getSnapshot().lastMove).toBeNull();
  });

  test('beginDrag clears a stale tap selection', () => {
    const { interaction } = setup();
    interaction.tap('e2');
    interaction.beginDrag('d2');
    expect(interaction.getSnapshot().selected).toBeNull();
    expect(interaction.getSnapshot().dragFrom).toBe('d2');
  });
});

describe('BoardInteraction promotion flow', () => {
  const PROMO_FEN = '8/P7/8/8/8/8/8/k6K w - - 0 1';

  test('drop onto the last rank parks a pending promotion', () => {
    const { game, interaction, events } = setup(PROMO_FEN);
    const outcome = interaction.drop('a7', 'a8');
    expect(outcome).toEqual({
      kind: 'promotion',
      pending: { from: 'a7', to: 'a8', color: 'w' },
    });
    expect(interaction.getSnapshot().pendingPromotion).toEqual({
      from: 'a7',
      to: 'a8',
      color: 'w',
    });
    expect(game.getSnapshot().lastMove).toBeNull();
    expect(events).toEqual([]);

    expect(interaction.pickPromotion('q')).toBe(true);
    expect(interaction.getSnapshot().pendingPromotion).toBeNull();
    expect(game.getSnapshot().lastMove?.promotion).toBe('q');
    expect(events).toEqual(['applied:a7a8']);
  });

  test('cancelPromotion drops the pending move and reports the hook', () => {
    const { game, interaction, events } = setup(PROMO_FEN);
    interaction.tap('a7');
    interaction.tap('a8');
    expect(interaction.getSnapshot().pendingPromotion).not.toBeNull();
    interaction.cancelPromotion();
    expect(interaction.getSnapshot().pendingPromotion).toBeNull();
    expect(game.getSnapshot().lastMove).toBeNull();
    expect(events).toEqual(['select:a7', 'promotion-cancel']);
    expect(interaction.pickPromotion('q')).toBe(false);
  });

  test('clear wipes selection, drag, and pending promotion', () => {
    const { interaction } = setup(PROMO_FEN);
    interaction.drop('a7', 'a8');
    interaction.clear();
    expect(interaction.getSnapshot()).toMatchObject({
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: null,
      legalTargets: [],
    });
  });
});

describe('BoardInteraction premoves', () => {
  test('queues a premove on your piece while the opponent is to move', () => {
    const { game, interaction } = setup();
    interaction.setPremovesEnabled(true);
    interaction.setPlayerColor('w');
    interaction.tap('e2');
    interaction.tap('e4');
    expect(game.getSnapshot().turn).toBe('b');
    expect(interaction.canDrag('d2')).toBe(true);
    interaction.drop('d2', 'd4');
    expect(interaction.getSnapshot().premove).toEqual({
      from: 'd2',
      to: 'd4',
    });
    expect(game.getSnapshot().turn).toBe('b');
  });

  test('flushPremmove applies when it becomes your turn', () => {
    const { game, interaction, events } = setup();
    interaction.setPremovesEnabled(true);
    interaction.setPlayerColor('w');
    interaction.tap('e2');
    interaction.tap('e4');
    interaction.drop('d2', 'd4');
    game.tryMove({ from: 'e7', to: 'e5' });
    const outcome = interaction.flushPremmove();
    expect(outcome?.kind).toBe('applied');
    expect(game.getSnapshot().lastMove?.to).toBe('d4');
    expect(interaction.getSnapshot().premove).toBeNull();
    expect(events).toContain('applied:d2d4');
  });

  test('flushPremmove reports illegal and clears the queue', () => {
    const { game, interaction, events } = setup();
    interaction.setPremovesEnabled(true);
    interaction.setPlayerColor('w');
    interaction.tap('e2');
    interaction.tap('e4');
    // Knight cannot jump to e3 (occupied by own pawn after e4… e3 empty actually).
    // Nb1-b5 is never legal.
    interaction.drop('b1', 'b5');
    game.tryMove({ from: 'e7', to: 'e5' });
    const outcome = interaction.flushPremmove();
    expect(outcome?.kind).toBe('illegal');
    expect(interaction.getSnapshot().premove).toBeNull();
    expect(events.some((e) => e.startsWith('illegal:'))).toBe(true);
  });
});

describe('BoardInteraction autoPromoteQueen', () => {
  test('applies queen without parking pendingPromotion', () => {
    const { game, interaction, events } = setup('8/P7/8/8/8/8/8/k6K w - - 0 1');
    interaction.setAutoPromoteQueen(true);
    const outcome = interaction.drop('a7', 'a8');
    expect(outcome.kind).toBe('applied');
    expect(interaction.getSnapshot().pendingPromotion).toBeNull();
    expect(game.getSnapshot().fen.includes('Q')).toBe(true);
    expect(events).toEqual(['applied:a7a8']);
  });
});
