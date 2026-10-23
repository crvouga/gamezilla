import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { z } from 'zod';
import { recordAttemptCompletion } from './attempt-completion';
import { advanceAttemptHistory, currentAttemptState } from './attempt-history';
import {
  attemptDefinition,
  readAttemptPosition,
  requireAttemptPlayer,
} from './attempt-store';
import { attemptCommandSchema, decodeAttemptHistory } from './attempt-types';
import { contentGame } from './content-store';
import { contentId } from './content-types';
import { saveAttemptPosition } from './save-attempt-position';

export const changePuzzleAttemptMutation = defineMutation({
  name: 'changePuzzleAttempt',
  args: z
    .object({
      attemptId: contentId,
      parentId: contentId,
      positionId: contentId,
      command: attemptCommandSchema,
    })
    .strict(),
  async run(ctx, args) {
    const attempt = await requireAttemptPlayer(ctx, args.attemptId);
    const parent = await readAttemptPosition(ctx.tx, attempt, args.parentId);
    const history = decodeAttemptHistory(parent.history);
    if (history === null)
      throw new MutationError(
        'PUZZLE_POSITION_INVALID',
        'Open another kept continuation. This one stays saved.'
      );
    const definition = await attemptDefinition(ctx, attempt);
    const game = contentGame(ctx.env, attempt.game_id);
    const next = advanceAttemptHistory({
      game,
      definition,
      history,
      command: args.command,
    });
    const state = currentAttemptState(next);
    const validation = game.rules.validateState(definition, state);
    if (!validation.valid)
      throw new MutationError(
        'PUZZLE_POSITION_INVALID',
        validation.issues[0]?.message ?? 'Choose another kept position.'
      );
    await saveAttemptPosition(ctx, {
      attempt,
      positionId: args.positionId,
      parentId: parent.id,
      history: JSON.stringify(next),
    });
    await recordAttemptCompletion(ctx, {
      attempt,
      positionId: args.positionId,
      game,
      definition,
      state,
    });
  },
});
