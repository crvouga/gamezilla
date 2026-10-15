import { describe, expect, test } from 'bun:test';
import type { RecordStepMeta } from '@crvouga/atlas/reports/report-types';
import type { Driver, DriverNode } from '@pkgs/ui-testing-root-shared/driver';
import { recordingDriver } from '@pkgs/ui-testing-root-shared/recording-driver';
import type { StepRecorder } from '@pkgs/ui-testing-root-shared/step-recorder';
import { describeUiOp, performUiOp } from '@pkgs/ui-testing-root-shared/ui-op';

function fakeNode(log: string[], path: string[]): DriverNode {
  const node: DriverNode = {
    get: (id) => fakeNode(log, [...path, id]),
    tap: async () => {
      log.push(`tap ${path.join('.')}`);
    },
    tapAt: async () => {
      log.push('tapAt');
    },
    drag: async () => {
      log.push('drag');
    },
    layout: async () => ({ x: 10, y: 20, width: 100, height: 40 }),
    selectFile: async () => {},
    input: async (text) => {
      log.push(`input ${text}`);
    },
    clear: async () => {
      log.push('clear');
    },
    key: async (key) => {
      log.push(`key ${key}`);
    },
    scroll: async (dir) => {
      log.push(`scroll ${dir}`);
    },
    wait: async () => {
      log.push('wait');
    },
    expect: {
      visible: async () => {
        log.push(`visible ${path.join('.')}`);
      },
      hidden: async () => {
        log.push('hidden');
      },
      text: async () => {
        log.push('text');
      },
    },
    isVisible: async () => true,
    text: async () => 'hi',
    attribute: async () => null,
  };
  return node;
}

function fakeDriver(log: string[]): Driver & { inventory: () => Promise<{}> } {
  return {
    kind: 'fake',
    launch: async () => undefined,
    close: async () => undefined,
    get: (id) => fakeNode(log, [id]),
    key: async (key) => {
      log.push(`root key ${key}`);
    },
    snapshotHtml: async () => '<html></html>',
    inventory: async () => ({}),
  };
}

function recorder(): StepRecorder & { readonly metas: RecordStepMeta[] } {
  const metas: RecordStepMeta[] = [];
  return {
    metas,
    record: async (meta, fn) => {
      metas.push(meta);
      return fn();
    },
  };
}

describe('recordingDriver', () => {
  test('records ops with selector and actor; reads pass through', async () => {
    const log: string[] = [];
    const rec = recorder();
    const driver = recordingDriver(fakeDriver(log), {
      recorder: rec,
      actorId: 'alice',
    });
    await driver.get('modal').get('ok').tap();
    await driver.get('email').input('a@b.c');
    await driver.get('home').expect.visible();
    await driver.key('escape');
    expect(await driver.get('home').isVisible()).toBe(true);
    expect(await driver.get('home').text()).toBe('hi');
    expect(await driver.snapshotHtml()).toBe('<html></html>');
    expect(log).toEqual([
      'tap modal.ok',
      'input a@b.c',
      'visible home',
      'root key escape',
    ]);
    expect(rec.metas.map((m) => [m.kind, m.title, m.selector])).toEqual([
      ['ui', 'tap', 'testId("modal") >> testId("ok")'],
      ['ui', 'input "a@b.c"', 'testId("email")'],
      ['expect', 'expect visible', 'testId("home")'],
      ['ui', 'key escape', 'testId(<empty>)'],
    ]);
    expect(rec.metas.every((m) => m.actorId === 'alice')).toBe(true);
    expect(rec.metas[0]!.hit).toEqual({ path: ['modal', 'ok'] });
    expect(rec.metas[0]!.snapshotBefore).toBe(true);
    expect(rec.metas[2]!.hit).toBeUndefined();
    expect(rec.metas[3]!.hit).toBeUndefined();
  });

  test('forwards explore inventory when present', async () => {
    const driver = recordingDriver(fakeDriver([]), { recorder: recorder() });
    expect('inventory' in driver).toBe(true);
  });
});

describe('UiOp', () => {
  test('performUiOp interprets ops; describeUiOp titles them', async () => {
    const log: string[] = [];
    const driver = fakeDriver(log);
    await performUiOp(driver, {
      actorId: 'a',
      op: 'tap',
      path: ['x', 'y'],
      extra: {},
    });
    await performUiOp(driver, {
      actorId: 'a',
      op: 'input',
      path: ['f'],
      extra: { text: 'hey' },
    });
    await performUiOp(driver, {
      actorId: 'a',
      op: 'key',
      path: [],
      extra: { key: 'enter' },
    });
    expect(log).toEqual(['tap x.y', 'input hey', 'root key enter']);
    expect(
      describeUiOp({ actorId: 'a', op: 'tap', path: ['x', 'y'], extra: {} })
    ).toBe('tap testId("x") >> testId("y")');
    expect(
      describeUiOp({
        actorId: 'a',
        op: 'input',
        path: ['f'],
        extra: { text: 'hey' },
      })
    ).toBe('input "hey" testId("f")');
    expect(
      describeUiOp({
        actorId: 'a',
        op: 'key',
        path: [],
        extra: { key: 'escape' },
      })
    ).toBe('key escape');
  });
});
