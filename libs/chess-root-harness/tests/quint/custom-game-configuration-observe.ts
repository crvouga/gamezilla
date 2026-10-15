import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import type { CustomGame } from '@libs/game-session-shared/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness/quint-world';
import type { QuintValue } from '@pkgs/quint-shared/itf';
import {
  CONFIGURATION_DEVICES,
  configurationName,
} from './custom-game-configuration-world';

function picture(w: QuintHarnessWorld, game: CustomGame | null) {
  return {
    status: game?.status ?? 'none',
    creator: configurationName(w, game?.creator ?? ''),
    white:
      game === null
        ? { kind: 'open', person: '' }
        : {
            kind: game.white.kind,
            person: configurationName(w, game.white.person),
          },
    black:
      game === null
        ? { kind: 'open', person: '' }
        : {
            kind: game.black.kind,
            person: configurationName(w, game.black.person),
          },
    ready: new Set(game?.ready ?? []),
    minutes: game?.minutes ?? 0,
    increment: game?.increment ?? 0,
    starts: game?.startedAt === null || game === null ? 0 : 1,
    outcome: game?.outcome ?? '',
    drawOfferedBy: configurationName(w, game?.drawOfferedBy ?? ''),
  };
}

export async function observeConfiguration(
  w: QuintHarnessWorld
): Promise<Readonly<Record<string, QuintValue>>> {
  const shown = new Map<string, ReturnType<typeof picture>>();
  for (const actor of CONFIGURATION_DEVICES) {
    const probe = await w.quiet.read(readCustomGameProbe, actor);
    shown.set(actor, picture(w, probe?.current ?? null));
  }
  const fields = [
    'status',
    'creator',
    'white',
    'black',
    'ready',
    'minutes',
    'increment',
    'starts',
    'outcome',
    'drawOfferedBy',
  ] as const;
  const observation: Record<string, QuintValue> = {};
  for (const field of fields)
    observation[`${field}Shown`] = new Map(
      [...shown].map(([actor, value]) => [actor, value[field]])
    );
  observation['refusal'] = w.memo.get('configuration-refusals') as Map<
    string,
    string
  >;
  return observation;
}
