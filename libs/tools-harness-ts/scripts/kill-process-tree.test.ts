import { expect, test } from 'bun:test';
import { descendantPids, killWindowsProcessTree } from './kill-process-tree';

test('cancellation includes detached task workers and excludes unrelated verifications', () => {
  // regression: verify-deadline-detached-workers
  const processes = [
    { pid: 43911, ppid: 100 },
    { pid: 46346, ppid: 43911 },
    { pid: 46347, ppid: 46346 },
    { pid: 46356, ppid: 46347 },
    { pid: 46357, ppid: 46356 },
    { pid: 70946, ppid: 100 },
    { pid: 71128, ppid: 70946 },
  ];
  expect(descendantPids(processes, 43911)).toEqual([
    46357, 46356, 46347, 46346, 43911,
  ]);
});

test('Windows cancellation kills the whole tree with taskkill and tolerates exited pids', () => {
  const calls: (readonly [string, readonly string[]])[] = [];
  killWindowsProcessTree(4321, (file, args) => {
    calls.push([file, args]);
    throw new Error('ERROR: The process "4321" not found.');
  });
  expect(calls).toEqual([['taskkill', ['/PID', '4321', '/T', '/F']]]);
});
