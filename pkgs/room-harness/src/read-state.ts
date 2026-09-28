import { expect } from 'bun:test';
import type { Run } from '@pkgs/harness';
import type { RoomState } from '@pkgs/room';
import {
  clientHash,
  clientState,
  connected,
  lastRejection,
  type RoomHarness,
  serverHash,
  serverState,
} from './scenario';

export async function readServer(s: Run<RoomHarness>): Promise<RoomState> {
  return (await s.read(serverState)) as RoomState;
}

export async function readClient(
  s: Run<RoomHarness>,
  id: string
): Promise<RoomState> {
  const all = (await s.read(clientState)) as Record<string, RoomState>;
  return all[id]!;
}

export async function readClientHash(
  s: Run<RoomHarness>,
  id: string
): Promise<string> {
  const all = (await s.read(clientHash)) as Record<string, string>;
  return all[id]!;
}

export async function expectHashMatch(
  s: Run<RoomHarness>,
  id: string
): Promise<void> {
  expect(await readClientHash(s, id)).toBe(await s.read(serverHash));
}

export async function readRejection(
  s: Run<RoomHarness>,
  id: string
): Promise<{ readonly type?: string } | null> {
  const all = (await s.read(lastRejection)) as Record<
    string,
    { readonly type?: string } | null
  >;
  return all[id] ?? null;
}

export async function isConnected(
  s: Run<RoomHarness>,
  id: string
): Promise<boolean> {
  const ids = (await s.read(connected)) as string[];
  return ids.includes(id);
}
