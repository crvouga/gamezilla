import { expect } from 'bun:test';
import type { Run } from '@pkgs/dst';
import {
  clientHash,
  clientState,
  connected,
  lastRejection,
  type RoomSurface,
  serverHash,
  serverState,
} from '../../sim/scenario';
import type { RoomState } from '../../types';

export async function readServer(run: Run<RoomSurface>): Promise<RoomState> {
  return (await run.observe(serverState)) as RoomState;
}

export async function readClient(
  run: Run<RoomSurface>,
  id: string
): Promise<RoomState> {
  const all = (await run.observe(clientState)) as Record<string, RoomState>;
  return all[id]!;
}

export async function readClientHash(
  run: Run<RoomSurface>,
  id: string
): Promise<string> {
  const all = (await run.observe(clientHash)) as Record<string, string>;
  return all[id]!;
}

export async function expectHashMatch(
  run: Run<RoomSurface>,
  id: string
): Promise<void> {
  expect(await readClientHash(run, id)).toBe(await run.observe(serverHash));
}

export async function readRejection(
  run: Run<RoomSurface>,
  id: string
): Promise<{ readonly type?: string } | null> {
  const all = (await run.observe(lastRejection)) as Record<
    string,
    { readonly type?: string } | null
  >;
  return all[id] ?? null;
}

export async function isConnected(
  run: Run<RoomSurface>,
  id: string
): Promise<boolean> {
  const ids = (await run.observe(connected)) as string[];
  return ids.includes(id);
}
