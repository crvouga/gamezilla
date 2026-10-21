import { describe, expect, test } from 'bun:test';
import { defineSubClient, type SubClient } from '@libs/sub-client-ts/client';
import { composeSubClients } from '@libs/sub-client-ts/compose-client';
import type { Component } from 'solid-js';

const Screen: Component = () => null;

function client(name: string, path: string): SubClient {
  return defineSubClient({
    name,
    routes: [{ path, component: Screen }],
  });
}

describe('composeSubClients', () => {
  test('a flat pair keeps list order and unions routes', () => {
    const folded = composeSubClients([
      client('widget', '/widget'),
      client('gadget', '/gadget'),
    ]);
    expect(folded.subNames).toEqual(['widget', 'gadget']);
    expect(folded.routes.map((route) => route.path)).toEqual([
      '/widget',
      '/gadget',
    ]);
  });

  test('a parent fold includes the child route and excludes the sibling', () => {
    const child = client('child', '/child');
    const sibling = client('sibling', '/sibling');
    const parent = defineSubClient({
      name: 'parent',
      routes: [{ path: '/parent', component: Screen }],
      subs: [child],
    });
    const folded = composeSubClients([parent]);
    expect(folded.subNames).toEqual(['parent', 'child']);
    expect(folded.routes.map((route) => route.path)).toEqual([
      '/parent',
      '/child',
    ]);
    const withSibling = composeSubClients([parent, sibling]);
    expect(withSibling.routes.map((route) => route.path)).toEqual([
      '/parent',
      '/child',
      '/sibling',
    ]);
  });

  test('a duplicate path still fails', () => {
    const child = client('child', '/child');
    const clash = client('clash', '/child');
    const parent = defineSubClient({
      name: 'parent',
      routes: [{ path: '/parent', component: Screen }],
      subs: [child, clash],
    });
    expect(() => composeSubClients([parent])).toThrow(/route '\/child'/);
  });

  test('a repeated name fails and a walk that re-enters a node fails', () => {
    const child = client('child', '/child');
    const again = client('child', '/other');
    const parent = defineSubClient({
      name: 'parent',
      routes: [],
      subs: [child, again],
    });
    expect(() => composeSubClients([parent])).toThrow(/duplicate sub 'child'/);
    const loop: SubClient = defineSubClient({
      name: 'loop',
      routes: [],
      get subs() {
        return [loop];
      },
    });
    expect(() => composeSubClients([loop])).toThrow(/re-enters 'loop'/);
  });
});
