import { readCustomGameProbe } from '@libs/game-session-harness-ts/custom-game-probe';
import type {
  CustomGame,
  CustomGameParticipant,
} from '@libs/game-session-shared-ts/custom-game-state';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import {
  CONFIGURATION_DEVICES,
  configurationName,
} from './custom-game-configuration-world';
import { modelResult, modelSide } from './model-game';

function participant(w: QuintHarnessWorld, side: CustomGameParticipant) {
  return { kind: side.kind, person: configurationName(w, side.person) };
}

function picture(w: QuintHarnessWorld, game: CustomGame | null) {
  return {
    status: game?.status ?? 'none',
    creator: configurationName(w, game?.creator ?? ''),
    firstSide:
      game === null ? { kind: 'open', person: '' } : participant(w, game.white),
    secondSide:
      game === null ? { kind: 'open', person: '' } : participant(w, game.black),
    ready: new Set((game?.ready ?? []).map(modelSide)),
    minutes: game?.minutes ?? 0,
    increment: game?.increment ?? 0,
    starts: game?.startedAt === null || game === null ? 0 : 1,
    result: modelResult(game?.outcome ?? ''),
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
    'firstSide',
    'secondSide',
    'ready',
    'minutes',
    'increment',
    'starts',
    'result',
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
