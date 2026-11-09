import {
  boardArgs,
  type renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { createSignal } from 'solid-js';
import { renderHeartsTable } from './hearts-table.example';

/** Reject one pass, then acknowledge the retry through the board's real reset contract. */
export function renderPassRecovery(
  context: Parameters<typeof renderGameTable>[3]
) {
  const [error, setError] = createSignal('');
  const [syncKey, setSyncKey] = createSignal(0);
  const [commitment, setCommitment] = createSignal<string | null>(null);
  return renderHeartsTable(
    {
      ...boardArgs(heartsRules.initial(), {
        hand: '2C3C4C5C6C7C8C9CTCJCQCKCAC',
      }),
      get interactive() {
        return commitment() === null;
      },
      get syncKey() {
        return syncKey();
      },
      get commitment() {
        return commitment();
      },
      get committed() {
        return commitment() === null ? [] : (['white'] as const);
      },
      onAction: (action) => {
        if (syncKey() === 0) {
          setError('The choice could not be confirmed. Try again.');
          setSyncKey(1);
          return;
        }
        setError('');
        setCommitment(action);
      },
    },
    {
      parameters: {
        ...context.parameters,
        table: {
          get error() {
            return error();
          },
        },
      },
    }
  );
}
