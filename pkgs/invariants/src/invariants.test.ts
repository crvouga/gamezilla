import { describe, expect, test } from 'bun:test';
import { always, reachable, sometimes, unreachable } from './assertions';
import {
  bindInvariantSink,
  currentInvariantSink,
  isInvariantSinkBound,
  unbindInvariantSink,
} from './sink';

describe('@pkgs/invariants', () => {
  test('noop sink outside harness', () => {
    always('noop.always', true, 0);
    sometimes('noop.sometimes', true, 0);
    reachable('noop.reachable', 0);
  });

  test('recording sink binds exclusively', () => {
    expect(isInvariantSinkBound()).toBe(false);
    bindInvariantSink();
    expect(isInvariantSinkBound()).toBe(true);
    expect(() => bindInvariantSink()).toThrow(/already bound/);
    always('test.always', true, 10);
    sometimes('test.sometimes', true, 20);
    reachable('test.reachable', 30);
    expect(currentInvariantSink().sometimesHits().get('test.sometimes')).toBe(
      1
    );
    expect(currentInvariantSink().reachableHits().get('test.reachable')).toBe(
      1
    );
    unbindInvariantSink();
    expect(isInvariantSinkBound()).toBe(false);
  });

  test('unreachable throws', () => {
    bindInvariantSink();
    expect(() => unreachable('bad.path', 5, () => 'detail')).toThrow(
      /bad\.path/
    );
    unbindInvariantSink();
  });
});
