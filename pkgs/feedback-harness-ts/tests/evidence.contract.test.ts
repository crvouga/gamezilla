import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { FeedbackController } from '@pkgs/feedback-client-ts/controller';
import { createEvidenceUploader } from '@pkgs/feedback-client-ts/upload-evidence';
import { FakeIssueReporter } from '@pkgs/feedback-server-ts/fake-issue-reporter';
import { createFeedbackHttpApp } from '@pkgs/feedback-server-ts/feedback-http-app';
import { FileSystemIssueReporter } from '@pkgs/feedback-server-ts/filesystem-issue-reporter';
import type { FeedbackReport } from '@pkgs/feedback-shared-ts/types';
import { readBytes } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const id = '73866a17-20db-4cd4-9a86-65c29bd3fd90';
test('evidence bytes and reproduction state survive submission through the same HTTP API', async () => {
  const { clock, timers } = createHarnessClock();
  const store = new ObjectStoreImplInMemory();
  const server = createFeedbackHttpApp({
    clock,
    store,
    reporter: new FileSystemIssueReporter(store),
    allowedOrigin: 'http://local',
  });
  const http = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      server(new Request(input, init)),
  };
  const controller = new FeedbackController({
    clock,
    timers,
    createId: () => id,
    authorId: 'local',
    workspace: { load: () => null, save: () => {} },
    evidence: store,
    providers: [
      {
        name: 'chess-puzzle',
        collect: () => ({
          initialFen: '8/8/8/8/8/8/4K3/7k w - - 0 1',
          solveIndex: 1,
        }),
      },
    ],
    reporter: Object.assign(new FakeIssueReporter(), {
      create: async (report: FeedbackReport) => {
        const response = await http.fetch('http://local/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        expect(response.status).toBe(201);
        return response.json() as Promise<{ id: string }>;
      },
    }),
    upload: createEvidenceUploader({
      http,
      timers,
      endpoint: 'http://local/api/feedback',
      createId: () => id,
    }),
  });
  controller.setDraft({
    body: 'The board froze',
  });
  await controller.attach({
    name: 'reproduction.webm',
    contentType: 'video/webm',
    bytes: new Uint8Array([1, 2, 3]),
  });
  await controller.send();
  expect(controller.state().phase).toBe('saved');
  const response = await server(
    new Request(`http://local/api/feedback/reports/${id}`)
  );
  const report = (await response.json()) as FeedbackReport;
  expect(report.diagnostics).toContainEqual({
    name: 'chess-puzzle',
    status: 'available',
    value: { initialFen: '8/8/8/8/8/8/4K3/7k w - - 0 1', solveIndex: 1 },
  });
  const attachment = report.attachments[0];
  expect(attachment?.name).toBe('reproduction.webm');
  const video = await server(new Request(attachment!.url));
  expect(new Uint8Array(await video.arrayBuffer())).toEqual(
    new Uint8Array([1, 2, 3])
  );
  const handoff = await store.get(`feedback-${id}/AGENT_HANDOFF.md`);
  expect(new TextDecoder().decode(await readBytes(handoff!.body))).toContain(
    'pin the literal input in a failing regression before changing the application'
  );
  controller.dispose();
  expect(clock.pendingOneShotCount()).toBe(0);
});

test('evidence validates type, origin, id and size before accepting bytes', async () => {
  await assertProperty(
    'feedback-evidence',
    fc.asyncProperty(
      fc.constantFrom('origin', 'id', 'type', 'size', 'empty'),
      async (bad) => {
        const store = new ObjectStoreImplInMemory();
        const server = createFeedbackHttpApp({
          clock: { now: () => 0 },
          store,
          reporter: new FileSystemIssueReporter(store),
          allowedOrigin: 'http://local',
        });
        const response = await server(
          new Request(
            `http://local/api/feedback/evidence/${bad === 'id' ? 'outside' : id}`,
            {
              method: 'POST',
              headers: {
                Origin: bad === 'origin' ? 'http://foreign' : 'http://local',
                'Content-Type': bad === 'type' ? 'text/html' : 'video/webm',
              },
              body: new Uint8Array(
                bad === 'size' ? 12 * 1024 * 1024 + 1 : bad === 'empty' ? 0 : 3
              ),
            }
          )
        );
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(await store.listKeys()).toEqual([]);
      }
    )
  );
});

// regression: feedback-evidence-ignores-abort
test('an attachment receipt body ignoring cancellation cannot trap submission', async () => {
  const { clock, timers } = createHarnessClock();
  const upload = createEvidenceUploader({
    endpoint: 'http://local/api/feedback',
    timers,
    createId: () => id,
    http: {
      fetch: async () =>
        ({ ok: true, json: () => new Promise(() => {}) }) as Response,
    },
  });
  const result = upload({
    name: 'reproduction.webm',
    contentType: 'video/webm',
    bytes: new Uint8Array([1, 2, 3]),
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  clock.advance(20_000);
  await expect(result).rejects.toThrow('Attachment upload timed out');
  expect(clock.pendingOneShotCount()).toBe(0);
});

// regression: feedback-changed-evidence-reuses-id
test('changed evidence receives a new report id after an uncertain delivery', async () => {
  const { clock, timers } = createHarnessClock();
  let ids = 0;
  const received: string[] = [];
  const controller = new FeedbackController({
    clock,
    timers,
    createId: () => `report-${++ids}`,
    authorId: 'local',
    workspace: { load: () => null, save: () => {} },
    evidence: new ObjectStoreImplInMemory(),
    providers: [],
    reporter: Object.assign(new FakeIssueReporter(), {
      create: (report: FeedbackReport) => {
        received.push(report.id);
        return received.length === 1
          ? Promise.reject(new Error('Receipt lost'))
          : Promise.resolve({ id: report.id });
      },
    }),
    upload: async (file) => ({
      id,
      name: file.name,
      contentType: file.contentType,
      size: file.bytes.length,
      url: `http://local/api/feedback/evidence/${id}`,
    }),
  });
  controller.setDraft({
    body: 'The board froze',
  });
  await controller.send();
  expect(controller.state().phase).toBe('failed');
  await controller.attach({
    name: 'updated-reproduction.webm',
    contentType: 'video/webm',
    bytes: new Uint8Array([1, 2, 3]),
  });
  await controller.send();
  expect(received).toEqual(['report-2', 'report-4']);
  expect(controller.state().phase).toBe('saved');
  controller.dispose();
});

function gatedEvidence() {
  const releases: (() => void)[] = [];
  const base = new ObjectStoreImplInMemory();
  const store = Object.assign(base, {
    put: async (key: string, bytes: Uint8Array, type: string) => {
      await new Promise<void>((resolve) => {
        releases.push(resolve);
      });
      await ObjectStoreImplInMemory.prototype.put.call(base, key, bytes, type);
    },
  });
  return { store, releaseAll: () => releases.splice(0).forEach((r) => r()) };
}

function attachmentController(
  evidence: ObjectStoreImplInMemory,
  received: FeedbackReport[]
) {
  const { clock, timers } = createHarnessClock();
  let ids = 0;
  return new FeedbackController({
    clock,
    timers,
    createId: () => `id-${++ids}`,
    authorId: 'local',
    workspace: { load: () => null, save: () => {} },
    evidence,
    providers: [],
    reporter: Object.assign(new FakeIssueReporter(), {
      create: (report: FeedbackReport) => {
        received.push(report);
        return Promise.resolve({ id: report.id });
      },
    }),
    upload: async (file) => ({
      id,
      name: file.name,
      contentType: file.contentType,
      size: file.bytes.length,
      url: `http://local/api/feedback/evidence/${id}`,
    }),
  });
}

const picture = (name: string) => ({
  name,
  contentType: 'image/png',
  bytes: new Uint8Array([1, 2, 3]),
});

// regression: feedback-attachment-send-race
test('sending while an attachment is still being saved includes that attachment', async () => {
  const gate = gatedEvidence();
  const received: FeedbackReport[] = [];
  const controller = attachmentController(gate.store, received);
  await controller.ready;
  controller.setDraft({ body: 'The board froze' });
  const attaching = controller.attach(picture('board.png'));
  const sending = controller.send();
  for (let i = 0; i < 50; i++) await Promise.resolve();
  gate.releaseAll();
  await attaching;
  await sending;
  expect(controller.state().phase).toBe('saved');
  expect(received).toHaveLength(1);
  expect(received[0]?.attachments.map((a) => a.name)).toEqual(['board.png']);
  controller.dispose();
});

// regression: feedback-concurrent-attachments
test('four files attached at once keep to the three-file limit', async () => {
  const gate = gatedEvidence();
  const controller = attachmentController(gate.store, []);
  await controller.ready;
  const attaching = ['a', 'b', 'c', 'd'].map((name) =>
    controller.attach(picture(`${name}.png`))
  );
  for (let i = 0; i < 50; i++) await Promise.resolve();
  gate.releaseAll();
  await Promise.all(attaching);
  expect(controller.state().files.map((f) => f.name)).toEqual([
    'a.png',
    'b.png',
    'c.png',
  ]);
  expect(controller.workspace.active()?.files).toHaveLength(3);
  controller.dispose();
});
