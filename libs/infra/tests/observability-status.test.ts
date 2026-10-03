import { expect, test } from 'bun:test';
import { permits } from './observability-condition';

// regression: deploy-grafana-archived-active-traces
test('archived stack with active traces remains usable by the trace-only module', () => {
  // Grafana stack 1842412 / shortawning2091 at the failed deploy:
  // status=archived, htInstanceStatus=active; Tempo search returned HTTP 200.
  expect(permits({ status: 'archived', traces_status: 'active' })).toBe(true);
});

test('unavailable traces and terminal or unknown stack states fail closed', () => {
  for (const status of ['active', 'paused', 'archived']) {
    expect(permits({ status, traces_status: 'active' })).toBe(true);
    for (const traces_status of [
      'archived',
      'deleted',
      'deleting',
      'unknown',
    ]) {
      expect(permits({ status, traces_status })).toBe(false);
    }
  }
  for (const status of ['deleted', 'deleting', 'unknown']) {
    expect(permits({ status, traces_status: 'active' })).toBe(false);
  }
});
