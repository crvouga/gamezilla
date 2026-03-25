import type { SimEvent } from './types';

export function story(e: SimEvent | null): string {
  if (!e) return '';
  const m: Record<string, string | (() => string)> = {
    topology: 'topology \u2014 network initialized.',
    client_write: () =>
      `client_write \u2014 client:${e.clientId} writes ${e.patchCount} patch${e.patchCount === 1 ? '' : 'es'} locally.`,
    server_write: () =>
      `server_write \u2014 server:${e.serverId} writes ${e.patchCount} patch${e.patchCount === 1 ? '' : 'es'}.`,
    push_start: () =>
      `push_start \u2014 client:${e.clientId} pushes patches to server.`,
    push_success: () =>
      `push_success \u2014 client:${e.clientId} push completed.`,
    push_fail: () =>
      `push_fail \u2014 client:${e.clientId} push rejected.`,
    poll_start: () =>
      `poll_start \u2014 client:${e.clientId} polls server for changes.`,
    poll_success: () =>
      `poll_success \u2014 client:${e.clientId} poll completed.`,
    poll_fail: () =>
      `poll_fail \u2014 client:${e.clientId} poll rejected.`,
    network_op: () =>
      `network_op ${e.op} ${e.phase} \u2014 client:${e.clientId}` +
      (e.phase === 'end' && e.ok === false ? ' (error)' : ''),
    remote_read: () =>
      `remote_read \u2014 server \u2192 client:${e.clientId} (${(e.results || []).reduce((s, r) => s + r.entityCount, 0)} entities, ${(e.results || []).reduce((s, r) => s + r.patchCount, 0)} patches).`,
    remote_write: () =>
      `remote_write \u2014 client:${e.clientId} \u2192 server (${e.returnedPatchCount} patch${e.returnedPatchCount === 1 ? '' : 'es'}).`,
    partition: () =>
      `partition \u2014 client:${e.clientId} partitioned from server.`,
    heal: () =>
      `heal \u2014 client:${e.clientId} partition healed.`,
    invalidation_scheduled: () =>
      `invalidation_scheduled \u2014 server schedules invalidation for client:${e.clientId}.`,
    invalidation_delivered: () =>
      `invalidation_delivered \u2014 invalidation reaches client:${e.clientId}.`,
    invalidation_dropped: () =>
      `invalidation_dropped \u2014 client:${e.clientId} (${e.reason}).`,
    subscribe: () =>
      `subscribe \u2014 client:${e.clientId} subscribes (${e.mode}).`,
    unsubscribe: () =>
      `unsubscribe \u2014 client:${e.clientId} unsubscribes (${e.mode}).`,
    sync_error: () =>
      `sync_error \u2014 client:${e.clientId} (${e.source}).`,
  };
  const fn = m[e.type];
  return typeof fn === 'function' ? fn() : fn || e.type;
}

export function shortDesc(e: SimEvent | null): string {
  if (!e) return '';
  const m: Record<string, string> = {
    client_write: `client_write ${e.clientId} (${e.patchCount})`,
    server_write: `server_write ${e.serverId} (${e.patchCount})`,
    push_start: `push_start ${e.clientId}`,
    push_success: `push_success ${e.clientId}`,
    push_fail: `push_fail ${e.clientId}`,
    poll_start: `poll_start ${e.clientId}`,
    poll_success: `poll_success ${e.clientId}`,
    poll_fail: `poll_fail ${e.clientId}`,
    network_op: `network_op ${e.op} ${e.phase}`,
    remote_read: `remote_read ${e.clientId}`,
    remote_write: `remote_write ${e.clientId}`,
    partition: `partition ${e.clientId}`,
    heal: `heal ${e.clientId}`,
    invalidation_scheduled: `invalidation_scheduled ${e.clientId}`,
    invalidation_delivered: `invalidation_delivered ${e.clientId}`,
    invalidation_dropped: `invalidation_dropped ${e.clientId}`,
    subscribe: `subscribe ${e.clientId}`,
    unsubscribe: `unsubscribe ${e.clientId}`,
    sync_error: `sync_error ${e.clientId}`,
    topology: 'topology',
  };
  return m[e.type] || e.type;
}
