import { type ScriptOptions, script } from '@pkgs/dst';
import type { RoomSystemDef } from '../../sim/scenario';
import { roomVirtualHost, SIM_START_MS } from '../../sim/scenario';
import type { RoomKnobs } from '../../sim/scenario/knobs';
import type { RoomSurface } from '../../sim/scenario/surface';

export type OpenRoomOpts = {
  readonly seed?: number | bigint | string;
  readonly clientCount?: number;
  readonly mildFaults?: boolean;
  readonly startTime?: number;
  readonly properties?: ScriptOptions<RoomSurface, RoomKnobs>['properties'];
};

/** `script` + default room virtual host. */
export async function openRoom(system: RoomSystemDef, opts?: OpenRoomOpts) {
  return script(system, {
    seed: opts?.seed ?? process.env['SIM_SEED'] ?? '42',
    knobs: {
      clientCount: opts?.clientCount ?? 0,
      mildFaults: opts?.mildFaults ?? false,
    },
    properties: opts?.properties ?? [],
    host: roomVirtualHost(opts?.startTime ?? SIM_START_MS),
  });
}
