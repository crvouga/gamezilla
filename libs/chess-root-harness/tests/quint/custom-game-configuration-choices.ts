import {
  customGameAcknowledgementTip,
  rememberCustomGameAcknowledgement,
} from '@libs/chess-custom-game-harness/custom-game-acknowledgement';
import {
  attemptCustomGameChoice,
  changeCustomGame,
} from '@libs/chess-custom-game-harness/custom-game-actions';
import {
  attemptCustomGameBoundary,
  readCustomGameBoundary,
} from '@libs/chess-custom-game-harness/custom-game-boundary';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import type {
  CustomGameChoice,
  CustomGameInput,
} from '@libs/chess-custom-game-shared/custom-game-choice';
import type { CustomGameSide } from '@libs/chess-custom-game-shared/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { Picks } from '@pkgs/quint-shared/registry';
import {
  configurationLink,
  configurationPerson,
} from './custom-game-configuration-world';

export function configurationInput(
  w: QuintHarnessWorld,
  command: string,
  picks: Picks
): CustomGameInput {
  const side = String(picks['side']) as CustomGameSide;
  switch (command) {
    case 'take':
    case 'bot':
    case 'open':
    case 'close':
    case 'accept':
    case 'decline':
    case 'revoke':
    case 'claim':
    case 'release':
      return { operation: command, side };
    case 'invite':
      return {
        operation: command,
        side,
        person: configurationPerson(w, String(picks['person'])),
      };
    case 'clock':
      return Number(picks['minutes'] ?? 1) === 0 &&
        Number(picks['increment'] ?? 0) === 0
        ? { operation: 'untimed' }
        : {
            operation: command,
            minutes: Number(picks['minutes'] ?? 1),
            increment: Number(picks['increment'] ?? 0),
          };
    case 'create':
    case 'rematch':
    case 'ready':
    case 'unready':
    case 'swap':
    case 'start':
    case 'cancel':
    case 'resign':
    case 'offer':
    case 'agree':
    case 'reject':
      return { operation: command };
    default:
      throw new Error(`Unknown Custom Game command ${command}`);
  }
}

export async function configurationReference(
  w: QuintHarnessWorld,
  actor: string
) {
  const game = (await w.quiet.read(readCustomGameProbe, actor))?.current;
  return { gameId: game?.id ?? null, revision: game?.revision ?? 0 };
}

export async function configurationChoice(
  w: QuintHarnessWorld,
  actor: string,
  input: CustomGameInput,
  reference?: { gameId: string | null; revision: number }
): Promise<void> {
  const probe = await w.quiet.read(readCustomGameProbe, actor);
  const spaceId = configurationLink(w).split('/space/')[1] ?? '';
  const before = await w.quiet.read(customGameAcknowledgementTip, spaceId);
  let reason: string;
  const choice: CustomGameChoice = {
    ...input,
    ...(reference ?? (await configurationReference(w, actor))),
  };
  if (probe === null) {
    await w.s.apply(attemptCustomGameBoundary, actor, {
      spaceId: configurationLink(w).split('/space/')[1] ?? '',
      choice,
    });
    const reply = await w.s.read(readCustomGameBoundary, actor);
    if (reply === null) throw new Error('Boundary attempt has no reply');
    reason = reply.reason;
  } else {
    if (reference === undefined)
      await w.s.apply(changeCustomGame, actor, input);
    else await w.s.apply(attemptCustomGameChoice, actor, choice);
    const after = await w.s.read(readCustomGameProbe, actor);
    if (after === null) throw new Error('Acknowledged choice lost its view');
    reason = after.error;
  }
  (w.memo.get('configuration-refusals') as Map<string, string>).set(
    actor,
    reason === 'only the host creates a Custom Game'
      ? 'only the creator'
      : reason
  );
  if (reason === '')
    await w.s.read(rememberCustomGameAcknowledgement, spaceId, choice, before);
  w.memo.set('configuration-last-choice', { actor, choice });
}

export async function competeConfiguration(
  w: QuintHarnessWorld,
  picks: Picks
): Promise<void> {
  const actor = String(picks['actor']);
  const other = String(picks['other']);
  const first = await w.quiet.read(readCustomGameProbe, actor);
  const reference = await configurationReference(
    w,
    first?.connected === true ? actor : other
  );
  const inputs = { ...picks, minutes: 1, increment: 0 };
  await configurationChoice(
    w,
    actor,
    configurationInput(w, String(picks['command']), inputs),
    reference
  );
  await configurationChoice(
    w,
    other,
    configurationInput(w, String(picks['otherCommand']), {
      ...inputs,
      side: picks['otherSide'] ?? 'white',
    }),
    reference
  );
}
