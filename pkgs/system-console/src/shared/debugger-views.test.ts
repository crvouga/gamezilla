import { describe, expect, test } from 'bun:test';

import {
  chromeKindForNodeKind,
  findNodeForInstance,
  instanceParamForNodeId,
  instancesForKind,
  nodeIdForKindInstance,
  sqliteNodeIdForApi,
} from './debugger-nodes';
import {
  aliasDebuggerView,
  coerceDebuggerView,
  viewsForKind,
} from './debugger-views';

describe('debugger-views', () => {
  test('aliases persisted report ids', () => {
    expect(aliasDebuggerView('html')).toBe('ui');
    expect(aliasDebuggerView('sqlite')).toBe('db');
    expect(aliasDebuggerView('logs')).toBe('events');
    expect(coerceDebuggerView('client', 'html')).toBe('ui');
    expect(coerceDebuggerView('api', 'sqlite')).toBe('db');
    expect(coerceDebuggerView('events', 'logs')).toBe('events');
  });

  test('hides commands/topics when flags are false', () => {
    expect(viewsForKind('api', { hasCommands: false })).toEqual([
      'db',
      'events',
    ]);
    expect(viewsForKind('events', { hasTopics: false })).toEqual(['events']);
    expect(viewsForKind('client')).toEqual(['ui', 'db', 'events']);
  });
});

describe('debugger-nodes', () => {
  test('folds db into api chrome kind', () => {
    expect(chromeKindForNodeKind('db')).toBe('api');
    expect(chromeKindForNodeKind('server')).toBe('api');
    const nodes = [
      { id: 'api', kind: 'api' },
      { id: 'db', kind: 'db' },
      { id: 'client:alice', kind: 'client' },
      { id: 'events', kind: 'events' },
    ];
    expect(instancesForKind(nodes, 'api').map((n) => n.id)).toEqual(['api']);
    expect(instancesForKind(nodes, 'client').map((n) => n.id)).toEqual([
      'client:alice',
    ]);
    expect(sqliteNodeIdForApi(nodes)).toBe('api');
  });

  test('kind + instance round-trip', () => {
    expect(nodeIdForKindInstance('client', 'alice')).toBe('client:alice');
    expect(nodeIdForKindInstance('client', 'client:bob')).toBe('client:bob');
    expect(nodeIdForKindInstance('api', 'anything')).toBe('api');
    expect(instanceParamForNodeId('client:alice')).toBe('alice');
    expect(instanceParamForNodeId('api')).toBe('api');
  });

  test('findNodeForInstance accepts short or full ids', () => {
    const nodes = [
      { id: 'client:alice', kind: 'client' },
      { id: 'bob', kind: 'client' },
    ];
    expect(findNodeForInstance(nodes, 'client', 'alice')?.id).toBe(
      'client:alice'
    );
    expect(findNodeForInstance(nodes, 'client', 'bob')?.id).toBe('bob');
    expect(findNodeForInstance(nodes, 'client', '')?.id).toBe('client:alice');
  });
});
