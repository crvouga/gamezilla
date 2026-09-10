import { describe, expect, mock, test } from 'bun:test';
import { selectUnifiedNode } from './select-unified-node';

function chromeSpy() {
  const onKindChange = mock(() => undefined);
  const onInstanceChange = mock(() => undefined);
  const onFocusedClientIdChange = mock(() => undefined);
  return {
    chrome: {
      kind: 'server' as const,
      instance: '',
      panes: {},
      onKindChange,
      onInstanceChange,
      onPanePatch: mock(() => undefined),
    },
    onFocusedClientIdChange,
    onKindChange,
    onInstanceChange,
  };
}

describe('selectUnifiedNode', () => {
  test('selects client even when chrome kind is not client', () => {
    const spy = chromeSpy();
    selectUnifiedNode(spy, [{ id: 'alice' }, { id: 'bob' }], 'alice');
    expect(spy.onKindChange).toHaveBeenCalledWith('client');
    expect(spy.onInstanceChange).toHaveBeenCalledWith('alice');
    expect(spy.onFocusedClientIdChange).toHaveBeenCalledWith('alice');
  });

  test('selects fixed server and events nodes', () => {
    const server = chromeSpy();
    selectUnifiedNode(server, [{ id: 'alice' }], 'server');
    expect(server.onKindChange).toHaveBeenCalledWith('server');
    expect(server.onInstanceChange).not.toHaveBeenCalled();

    const events = chromeSpy();
    selectUnifiedNode(events, [{ id: 'alice' }], 'events');
    expect(events.onKindChange).toHaveBeenCalledWith('events');
  });

  test('treats unknown ids as room topics', () => {
    const spy = chromeSpy();
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    selectUnifiedNode(spy, [{ id: 'alice' }], topic);
    expect(spy.onKindChange).toHaveBeenCalledWith('room');
    expect(spy.onInstanceChange).toHaveBeenCalledWith(topic);
  });
});
