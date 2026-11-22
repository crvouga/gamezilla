import { expect, test } from 'bun:test';
import {
  summarizeLongTasks,
  type TraceEvent,
} from '../storybook/long-task-trace';

const main = { pid: 1, tid: 7 };

test('a long main-thread task reports its CPU time, nested events and samples', () => {
  const events: TraceEvent[] = [
    {
      ...main,
      name: 'thread_name',
      ph: 'M',
      ts: 0,
      args: { name: 'CrRendererMain' },
    },
    // A short task and a task on another thread are not long main tasks.
    { ...main, name: 'RunTask', ph: 'X', ts: 0, dur: 4_000, tdur: 4_000 },
    { pid: 1, tid: 9, name: 'RunTask', ph: 'X', ts: 0, dur: 90_000 },
    {
      ...main,
      name: 'RunTask',
      ph: 'X',
      ts: 10_000,
      dur: 60_000,
      tdur: 20_000,
    },
    {
      ...main,
      name: 'FunctionCall',
      ph: 'X',
      ts: 11_000,
      dur: 12_000,
      args: { data: { functionName: 'move', url: 'http://x/board.js' } },
    },
    { ...main, name: 'MajorGC', ph: 'X', ts: 30_000, dur: 6_000 },
    { ...main, name: 'MajorGC', ph: 'X', ts: 40_000, dur: 2_000 },
    {
      ...main,
      name: 'Profile',
      ph: 'P',
      ts: 0,
      id: '0x1',
      args: { data: { startTime: 9_000 } },
    },
    {
      ...main,
      name: 'ProfileChunk',
      ph: 'P',
      ts: 0,
      id: '0x1',
      args: {
        data: {
          cpuProfile: {
            nodes: [
              {
                id: 1,
                callFrame: { functionName: 'move', url: 'http://x/board.js' },
              },
            ],
            samples: [1, 1, 1],
          },
          timeDeltas: [1_000, 2_000, 3_000],
        },
      },
    },
  ];
  expect(summarizeLongTasks(events)).toEqual([
    {
      wallMs: 60,
      threadMs: 20,
      events: [
        ['FunctionCall move board.js', 12],
        ['MajorGC', 8],
      ],
      selfTime: [['move board.js:1', 5]],
    },
  ]);
});

// regression: long-task-trace-frame-without-url
test('a profiled frame with no script is named without a file', () => {
  const events: TraceEvent[] = [
    {
      ...main,
      name: 'thread_name',
      ph: 'M',
      ts: 0,
      args: { name: 'CrRendererMain' },
    },
    { ...main, name: 'RunTask', ph: 'X', ts: 10_000, dur: 60_000 },
    {
      ...main,
      name: 'Profile',
      ph: 'P',
      ts: 0,
      id: '0x1',
      args: { data: { startTime: 9_000 } },
    },
    {
      ...main,
      name: 'ProfileChunk',
      ph: 'P',
      ts: 0,
      id: '0x1',
      args: {
        data: {
          cpuProfile: {
            nodes: [
              { id: 1, callFrame: { functionName: '(garbage collector)' } },
            ],
            samples: [1, 1],
          },
          timeDeltas: [2_000, 2_000],
        },
      },
    },
  ];
  expect(summarizeLongTasks(events)[0]?.selfTime).toEqual([
    ['(garbage collector)', 2],
  ]);
});
