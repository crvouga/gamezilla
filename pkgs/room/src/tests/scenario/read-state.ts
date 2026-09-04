import { expect } from 'bun:test';
import type { Script } from '@pkgs/dst';
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

export async function readServer(s: Script<RoomSurface>): Promise<RoomState> {
  return (await s.observe(serverState)) as RoomState;
}

export async function readClient(
  s: Script<RoomSurface>,
  id: string
): Promise<RoomState> {
  const all = (await s.observe(clientState)) as Record<string, RoomState>;
  return all[id]!;
}

export async function readClientHash(
  s: Script<RoomSurface>,
  id: string
): Promise<string> {
  const all = (await s.observe(clientHash)) as Record<string, string>;
  return all[id]!;
}

export async function expectHashMatch(
  s: Script<RoomSurface>,
  id: string
): Promise<void> {
  expect(await readClientHash(s, id)).toBe(await s.observe(serverHash));
}

export async function readRejection(
  s: Script<RoomSurface>,
  id: string
): Promise<{ readonly type?: string } | null> {
  const all = (await s.observe(lastRejection)) as Record<
    string,
    { readonly type?: string } | null
  >;
  return all[id] ?? null;
}

export async function isConnected(
  s: Script<RoomSurface>,
  id: string
): Promise<boolean> {
  const ids = (await s.observe(connected)) as string[];
  return ids.includes(id);
}
