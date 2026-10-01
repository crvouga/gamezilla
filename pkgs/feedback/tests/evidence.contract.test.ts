import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import {
  createEvidenceUploader,
  FeedbackController,
} from '@pkgs/feedback/client';
import {
  createFeedbackHttpApp,
  FileSystemIssueReporter,
} from '@pkgs/feedback/server';
import type { FeedbackReport } from '@pkgs/feedback/shared';
import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { assertProperty, fc } from '@pkgs/property';

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
    providers: [
      {
        name: 'chess-puzzle',
        collect: () => ({
          initialFen: '8/8/8/8/8/8/4K3/7k w - - 0 1',
          solveIndex: 1,
        }),
      },
    ],
    reporter: {
      create: async (report) => {
        const response = await http.fetch('http://local/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        expect(response.status).toBe(201);
        return response.json() as Promise<{ id: string }>;
      },
    },
    upload: createEvidenceUploader({
      http,
      timers,
      endpoint: 'http://local/api/feedback',
      createId: () => id,
    }),
  });
  controller.setDraft({
    description: 'The board froze',
    expected: 'The legal move appears',
    reproductionSteps: 'Drag e2 to e3',
  });
  controller.attach({
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
    'demonstrate the failure before changing the product'
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
