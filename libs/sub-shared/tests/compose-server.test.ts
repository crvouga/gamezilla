import { describe, expect, test } from 'bun:test';
import { composeSubServers } from '@libs/sub-shared/compose-server';
import {
  defineSubServer,
  type RoomGrantsCtx,
  type SubServer,
} from '@libs/sub-shared/server';

const ctx = {} as RoomGrantsCtx;

function server(name: string, grant: string): SubServer {
  return defineSubServer({
    name,
    roomGrants: () => Promise.resolve([grant]),
  });
}

describe('composeSubServers', () => {
  test('a flat pair keeps list order and unions room grants', async () => {
    const folded = composeSubServers([
      server('widget', 'widget-grant'),
      server('gadget', 'gadget-grant'),
    ]);
    expect(folded.subNames).toEqual(['widget', 'gadget']);
    expect(await folded.roomGrants(ctx)).toEqual([
      'gadget-grant',
      'widget-grant',
    ]);
  });

  test('a parent fold includes the child grant and excludes the sibling', async () => {
    const child = server('child', 'child-grant');
    const sibling = server('sibling', 'sibling-grant');
    const parent = defineSubServer({
      name: 'parent',
      roomGrants: () => Promise.resolve(['parent-grant']),
      subs: [child],
    });
    const folded = composeSubServers([parent]);
    expect(folded.subNames).toEqual(['parent', 'child']);
    expect(await folded.roomGrants(ctx)).toEqual([
      'child-grant',
      'parent-grant',
    ]);
    const withSibling = composeSubServers([parent, sibling]);
    expect(withSibling.subNames).toEqual(['parent', 'child', 'sibling']);
    expect(await withSibling.roomGrants(ctx)).toContain('sibling-grant');
  });

  test('a repeated name fails and a walk that re-enters a node fails', () => {
    expect(() =>
      composeSubServers([server('twin', 'a'), server('twin', 'b')])
    ).toThrow(/duplicate sub 'twin'/);
    const loop: SubServer = defineSubServer({
      name: 'loop',
      get subs() {
        return [loop];
      },
    });
    expect(() => composeSubServers([loop])).toThrow(/re-enters 'loop'/);
  });
});
