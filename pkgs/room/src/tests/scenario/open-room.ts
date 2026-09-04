import type { RoomSystemDef } from '../../sim/scenario';
import type { RoomArgs } from '../../sim/scenario/args';

export type OpenRoomOpts = {
  readonly seed?: number | bigint | string;
  readonly clientCount?: number;
  readonly mildFaults?: boolean;
  readonly host?: string;
};

/** `system.script` with default room args on the registered virtual host. */
export async function openRoom(system: RoomSystemDef, opts?: OpenRoomOpts) {
  const args: Partial<RoomArgs> = {
    clientCount: opts?.clientCount ?? 0,
    mildFaults: opts?.mildFaults ?? false,
  };
  return system.script({
    seed: opts?.seed ?? process.env['SIM_SEED'] ?? '42',
    args,
    host: opts?.host,
  });
}
