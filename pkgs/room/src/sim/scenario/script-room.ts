import { type Run, type ScriptOptions, script, virtualHost } from '@pkgs/dst';
import { type RoomSystemDef, SIM_START_MS } from './define-room-system';
import type { RoomSurface } from './surface';

export type ScriptRoomOpts = {
  readonly seed?: number | bigint | string;
  readonly clientCount?: number;
  readonly mildFaults?: boolean;
  readonly startTime?: number;
  readonly properties?: ScriptOptions<RoomSurface>['properties'];
};

export async function scriptRoom(
  system: RoomSystemDef,
  opts?: ScriptRoomOpts
): Promise<Run<RoomSurface>> {
  const seed = opts?.seed ?? process.env['SIM_SEED'] ?? '42';
  return script(system, {
    seed,
    knobs: {
      clientCount: opts?.clientCount ?? 0,
      mildFaults: opts?.mildFaults ?? false,
    },
    properties: opts?.properties ?? [],
    host: virtualHost({
      startTime: opts?.startTime ?? SIM_START_MS,
    }),
  });
}
