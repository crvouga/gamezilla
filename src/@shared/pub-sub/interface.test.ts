import { describe, expect, mock, test } from 'bun:test';
import { InMemoryPubSub } from './impl-in-memory';

describe('PublishSubscribe', () => {
  test('delivers message to subscriber', () => {
    const ps = new InMemoryPubSub();
    const fn = mock();
    ps.subscribe('greet', fn);
    ps.publish('greet', 'hello');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('hello');
  });

  test('delivers to multiple subscribers on the same topic', () => {
    const ps = new InMemoryPubSub();
    const fn1 = mock();
    const fn2 = mock();
    ps.subscribe('topic', fn1);
    ps.subscribe('topic', fn2);
    ps.publish('topic', 42);
    expect(fn1).toHaveBeenCalledWith(42);
    expect(fn2).toHaveBeenCalledWith(42);
  });

  test('does not deliver to subscribers on other topics', () => {
    const ps = new InMemoryPubSub();
    const fn = mock();
    ps.subscribe('a', fn);
    ps.publish('b', 'msg');
    expect(fn).not.toHaveBeenCalled();
  });

  test('unsubscribe stops delivery', () => {
    const ps = new InMemoryPubSub();
    const fn = mock();
    const unsub = ps.subscribe('topic', fn);
    ps.publish('topic', 1);
    unsub();
    ps.publish('topic', 2);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
  });

  test('publish with no subscribers does not throw', () => {
    const ps = new InMemoryPubSub();
    expect(() => ps.publish('empty', 'data')).not.toThrow();
  });

  test('supports structured message objects', () => {
    const ps = new InMemoryPubSub();
    const fn = mock();
    ps.subscribe('user', fn);
    ps.publish('user', { id: 1, name: 'alice' });
    expect(fn).toHaveBeenCalledWith({ id: 1, name: 'alice' });
  });

  test('multiple unsubscribes are safe', () => {
    const ps = new InMemoryPubSub();
    const fn = mock();
    const unsub = ps.subscribe('topic', fn);
    unsub();
    unsub();
    ps.publish('topic', 'data');
    expect(fn).not.toHaveBeenCalled();
  });
});
