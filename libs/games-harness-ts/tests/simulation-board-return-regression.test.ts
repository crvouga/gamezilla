import { expect, test } from 'bun:test';
import { establishGameSession } from '@libs/game-session-harness-ts/game-session-lineup';
import { gameSessionView } from '@libs/game-session-harness-ts/game-session-probe';
import { focusActor } from '@libs/harness-ts/shell-actions';
import { LIGHT_CYCLES_DUEL_HARNESS_GAME } from '@libs/light-cycles-harness-ts/light-cycles-harness-game';
import { PONG_HARNESS_GAME } from '@libs/pong-harness-ts/pong-harness-game';
import { QUORIDOR_HARNESS_GAME } from '@libs/quoridor-harness-ts/quoridor-harness-game';
import { closeSpaceScreen } from '@libs/spaces-harness-ts/space-actions';
import { endOffered } from '@libs/spaces-harness-ts/space-ending-ui-reads';
import { returnToRetainedSpace } from '@libs/spaces-harness-ts/space-retained-actions';
import {
  leaveOffered,
  readSpaceLink,
  renameOffered,
} from '@libs/spaces-harness-ts/spaces-ui-reads';
import { openConformanceHarness } from './conformance-world';

// regression: space-bar-actions-hidden
// regression: simulation-board-release-reads-controls-while-disposed
test.each([
  { game: PONG_HARNESS_GAME, actor: 'alice' },
  { game: QUORIDOR_HARNESS_GAME, actor: 'bob' },
  { game: LIGHT_CYCLES_DUEL_HARNESS_GAME, actor: 'alice' },
])(
  '$actor minimizes and restores the same active $game.label game',
  async ({ game, actor }) => {
    await using s = await openConformanceHarness();
    await s.apply(establishGameSession, game.shared.id, {});
    await s.apply(focusActor, actor);
    expect(await s.read(leaveOffered, actor)).toBe(actor !== 'alice');
    expect(await s.read(renameOffered, actor)).toBe(actor === 'alice');
    expect(await s.read(endOffered, actor)).toBe(actor === 'alice');
    const link = await s.read(readSpaceLink, actor);
    if (!link) throw new Error('Expected an open space');
    const before = await s.read((world) => gameSessionView(world, actor));
    expect(before.current?.status).toBe('active');
    await s.apply(closeSpaceScreen, actor);
    await s.apply(returnToRetainedSpace, actor, link);
    const seen = await s.read((world) => gameSessionView(world, actor));
    expect(seen.current?.id).toBe(before.current?.id);
    expect(seen.current?.status).toBe('active');
    expect(seen.current?.outcome ?? '').toBe('');
  },
  120_000
);
