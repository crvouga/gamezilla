import { describe, expect, mock, test } from 'bun:test';
import { selectUnifiedNode } from '@pkgs/harness-console-client/select-unified-node';
import type { UnifiedTopology } from '@pkgs/harness-console-client/select-unified-node';

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
  servers: readonly { readonly id: string }[] = [{ id: 'server-a' }]
): UnifiedTopology {
  return { clients, servers, loadBalancerId: 'lb' };
}

describe('selectUnifiedNode', () => {
  test('selects client even when chrome kind is not client', () => {
    const spy = chromeSpy();
    selectUnifiedNode(
      spy,
      topology([{ id: 'client-a' }, { id: 'client-b' }]),
      'client-a'
    );
    expect(spy.onKindChange).toHaveBeenCalledWith('client');
    expect(spy.onInstanceChange).toHaveBeenCalledWith('client-a');
    expect(spy.onFocusedClientIdChange).toHaveBeenCalledWith('client-a');
  });

  test('selects the balancer and pubsub nodes without an instance', () => {
    const lb = chromeSpy();
    selectUnifiedNode(lb, topology([{ id: 'client-a' }]), 'lb');
    expect(lb.onKindChange).toHaveBeenCalledWith('lb');
    expect(lb.onInstanceChange).not.toHaveBeenCalled();

    const events = chromeSpy();
    selectUnifiedNode(events, topology([{ id: 'client-a' }]), 'events');
    expect(events.onKindChange).toHaveBeenCalledWith('events');
    expect(events.onInstanceChange).not.toHaveBeenCalled();
  });

  test('selects a specific server instance', () => {
    const spy = chromeSpy();
    const nodes = topology(
      [{ id: 'client-a' }],
      [{ id: 'server-a' }, { id: 'server-b' }]
    );
    selectUnifiedNode(spy, nodes, 'server-b');
    expect(spy.onKindChange).toHaveBeenCalledWith('server');
    expect(spy.onInstanceChange).toHaveBeenCalledWith('server-b');
  });

  test('treats unknown ids as room topics', () => {
    const spy = chromeSpy();
    const topic = '199f2d72-aaaa-bbbb-cccc-ddddeeee0001';
    selectUnifiedNode(spy, topology([{ id: 'client-a' }]), topic);
    expect(spy.onKindChange).toHaveBeenCalledWith('room');
    expect(spy.onInstanceChange).toHaveBeenCalledWith(topic);
  });
});
