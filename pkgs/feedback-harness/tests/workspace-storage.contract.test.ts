import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createBrowserWorkspace } from '@pkgs/feedback-client/browser-workspace';
import { FeedbackController } from '@pkgs/feedback-client/controller';
import { FakeIssueReporter } from '@pkgs/feedback-server/fake-issue-reporter';
import type { FeedbackWorkspaceSnapshot } from '@pkgs/feedback-shared/workspace';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

function storage() {
  const values = new Map<string, string>();
  const port: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
  return port;
}
test('the browser journal imports the complete old draft before retiring its original key', async () => {
  await assertProperty(
    'feedback-draft-journal',
    fc.asyncProperty(
      fc.string(),
      fc.string(),
      fc.string(),
      async (body, expected, reproductionSteps) => {
        const port = storage();
        const original = JSON.stringify({
          kind: 'problem',
          description: body,
          expected,
          reproductionSteps,
        });
        port.setItem('root-feedback-draft', original);
        const adapter = createBrowserWorkspace({
          storage: () => port,
          createId: () => 'draft-id',
        });
        const snapshot = adapter.workspace.load();
        expect(snapshot?.documents[0]?.body).toContain(body);
        expect(snapshot?.documents[0]?.body).toContain(expected);
        expect(snapshot?.documents[0]?.body).toContain(reproductionSteps);
        expect(port.getItem('root-feedback-draft')).toBe(original);
        adapter.workspace.save(snapshot!);
        expect(port.getItem('root-feedback-draft')).toBeNull();
        expect(adapter.workspace.load()).toEqual(snapshot);
        expect(
          createBrowserWorkspace({
            storage: () => port,
            createId: () => 'another-id',
          }).authorId
        ).toBe(adapter.authorId);
      }
    )
  );
});

test('browser journals are isolated by host namespace', () => {
  const port = storage();
  const first = createBrowserWorkspace({
    storage: () => port,
    createId: () => 'first-author',
    namespace: 'first-app',
  });
  const second = createBrowserWorkspace({
    storage: () => port,
    createId: () => 'second-author',
    namespace: 'second-app',
  });

  expect(first.authorId).toBe('first-author');
  expect(second.authorId).toBe('second-author');
  expect(port.getItem('first-app-author')).toBe('first-author');
  expect(port.getItem('second-app-author')).toBe('second-author');
});

function fixture(evidence = new ObjectStoreImplInMemory()) {
  const { clock, timers } = createHarnessClock();
  const repository = new FakeIssueReporter();
  let ids = 0;
  let snapshot: FeedbackWorkspaceSnapshot | null = null;
  const options = {
    clock,
    timers,
    authorId: 'author-one',
    providers: [],
    reporter: repository,
    evidence,
    createId: () => `id-${++ids}`,
    workspace: {
      load: () => snapshot,
      save: (next: FeedbackWorkspaceSnapshot) => {
        snapshot = structuredClone(next);
      },
    },
  };
  return { options, persisted: () => snapshot, repository };
}

// regression: feedback-attachment-switches-draft
test('an attachment completing after selection changes only its original persisted draft', async () => {
  let release: (() => void) | undefined;
  const base = new ObjectStoreImplInMemory();
  const evidence = Object.assign(base, {
    put: async (key: string, bytes: Uint8Array, type: string) => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      await ObjectStoreImplInMemory.prototype.put.call(base, key, bytes, type);
    },
  });
  const world = fixture(evidence);
  const controller = new FeedbackController(world.options);
  await controller.ready;
  const original = controller.workspace.state().activeId;
  const attaching = controller.attach({
    name: 'board.png',
    contentType: 'image/png',
    bytes: new Uint8Array([1, 2, 3]),
  });
  await controller.newDraft();
  release?.();
  await attaching;
  const docs = world.persisted()?.documents;
  expect(docs?.find((d) => d.id === original)?.files).toHaveLength(1);
  expect(docs?.find((d) => d.id !== original)?.files).toHaveLength(0);
  controller.dispose();
});

// regression: feedback-reload-repeats-submission
test('the journal preserves an uncertain submission id through controller recreation', async () => {
  const world = fixture();
  const submitted: string[] = [];
  world.repository.create = async (report) => {
    submitted.push(report.id);
    throw new Error('Receipt lost');
  };
  const first = new FeedbackController(world.options);
  await first.ready;
  first.setDraft({
    title: 'Board stopped',
    body: 'Stopped after a move',
  });
  await first.send();
  first.dispose();
  const second = new FeedbackController(world.options);
  await second.ready;
  await second.send();
  expect(submitted).toHaveLength(2);
  expect(submitted[1]).toBe(submitted[0]);
  second.dispose();
});

// regression: feedback-raw-transport-error
test('a raw transport failure keeps the draft and exposes only actionable recovery', async () => {
  const world = fixture();
  world.repository.create = () => Promise.reject(new TypeError('Load failed'));
  const controller = new FeedbackController(world.options);
  await controller.ready;
  controller.setDraft({
    title: 'Board movement',
    body: 'Keep the last move visible',
  });
  await controller.send();
  expect(controller.state().phase).toBe('failed');
  expect(controller.state().message).toBe(
    'Draft kept on this device. Send it when reporting is available.'
  );
  expect(controller.state().message).not.toContain('Load failed');
  expect(world.persisted()?.documents[0]?.body).toBe(
    'Keep the last move visible'
  );
  expect(JSON.parse(controller.emergencyCopy())).toMatchObject({
    schema: 'feedback.report/v2',
    body: { source: 'Keep the last move visible' },
  });
  controller.dispose();
});
