import { describe, expect, mock, test } from 'bun:test';
import { selectUnifiedNode, type UnifiedTopology } from './select-unified-node';

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

function topology(
  clients: readonly { readonly id: string }[],
  servers: readonly { readonly id: string }[] = [{ id: 'server' }]
): UnifiedTopology {
  return { clients, servers, loadBalancerId: 'lb' };
}

describe('selectUnifiedNode', () => {
  test('selects client even when chrome kind is not client', () => {
    const spy = chromeSpy();
    selectUnifiedNode(spy, topology([{ id: 'alice' }, { id: 'bob' }]), 'alice');
    expect(spy.onKindChange).toHaveBeenCalledWith('client');
    expect(spy.onInstanceChange).toHaveBeenCalledWith('alice');
    expect(spy.onFocusedClientIdChange).toHaveBeenCalledWith('alice');
  });

  test('selects the balancer and pubsub nodes without an instance', () => {
    const lb = chromeSpy();
    selectUnifiedNode(lb, topology([{ id: 'alice' }]), 'lb');
    expect(lb.onKindChange).toHaveBeenCalledWith('lb');
    expect(lb.onInstanceChange).not.toHaveBeenCalled();

    const events = chromeSpy();
    selectUnifiedNode(events, topology([{ id: 'alice' }]), 'events');
    expect(events.onKindChange).toHaveBeenCalledWith('events');
    expect(events.onInstanceChange).not.toHaveBeenCalled();
  });

  test('selects a specific server instance', () => {
    const spy = chromeSpy();
    const nodes = topology(
      [{ id: 'alice' }],
      [{ id: 'server' }, { id: 'server-2' }]
    );
    selectUnifiedNode(spy, nodes, 'server-2');
    expect(spy.onKindChange).toHaveBeenCalledWith('server');
    expect(spy.onInstanceChange).toHaveBeenCalledWith('server-2');
  });

  test('treats unknown ids as room topics', () => {
    const spy = chromeSpy();
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    selectUnifiedNode(spy, topology([{ id: 'alice' }]), topic);
    expect(spy.onKindChange).toHaveBeenCalledWith('room');
    expect(spy.onInstanceChange).toHaveBeenCalledWith(topic);
  });
});
