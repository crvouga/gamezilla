import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { HttpIssueReporter } from '@pkgs/feedback-client/http-issue-reporter';
import { createEvidenceUploader } from '@pkgs/feedback-client/upload-evidence';
import { ArchivedIssueReporter } from '@pkgs/feedback-server/archived-issue-reporter';
import { FakeIssueReporter } from '@pkgs/feedback-server/fake-issue-reporter';
import { createFeedbackHttpApp } from '@pkgs/feedback-server/feedback-http-app';
import { FileSystemIssueReporter } from '@pkgs/feedback-server/filesystem-issue-reporter';
import { GitHubIssueReporter } from '@pkgs/feedback-server/github-issue-reporter';
import { createFeedbackBody } from '@pkgs/feedback-shared/report-body';
import type {
  FeedbackReport,
  FeedbackRepository,
} from '@pkgs/feedback-shared/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

function report(id: string, authorId: string, body: string): FeedbackReport {
  return {
    schema: 'feedback.report/v2',
    id,
    authorId,
    title: 'Board movement',
    kind: 'polish',
    body: createFeedbackBody(body),
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'open',
    diagnostics: [],
    recording: null,
    attachments: [],
  };
}
function github(store: ObjectStoreImplInMemory) {
  const requests: { method: string; body: Record<string, unknown> }[] = [];
  const destination = new GitHubIssueReporter({
    repository: 'team/product',
    token: 'in-process-token',
    reportBaseUrl: 'https://example.com/api/feedback/reports',
    http: {
      async fetch(input, init) {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        requests.push({ method: init?.method ?? 'GET', body });
        return String(input).endsWith('/graphql')
          ? Response.json({ data: { deleteIssue: { clientMutationId: null } } })
          : Response.json(
              {
                number: 42,
                node_id: 'issue-node',
                html_url: 'https://github.com/team/product/issues/42',
              },
              { status: 201 }
            );
      },
    },
  });
  return {
    repository: new ArchivedIssueReporter(store, destination),
    requests,
  };
}

test.each(['fake', 'filesystem', 'github'] as const)(
  '%s repository round-trips authored reports and retains deletion tombstones',
  async (mode) => {
    await assertProperty(
      'feedback-repository',
      fc.asyncProperty(
        fc
          .string({ minLength: 1, maxLength: 100 })
          .filter((s) => s.trim().length > 0),
        async (body) => {
          const store = new ObjectStoreImplInMemory();
          const external = github(store);
          const repository: FeedbackRepository =
            mode === 'fake'
              ? new FakeIssueReporter()
              : mode === 'filesystem'
                ? new FileSystemIssueReporter(store)
                : external.repository;
          const original = report('report-one', 'author-one', body);
          await repository.create(original);
          await repository.create({
            ...original,
            body: createFeedbackBody('Duplicate delivery'),
          });
          await expect(
            repository.create({ ...original, authorId: 'author-two' })
          ).rejects.toThrow('another developer');
          await repository.create(
            report('report-two', 'author-two', 'Another observation')
          );
          expect(await repository.list('author-one')).toEqual([original]);
          expect(await repository.read(original.id, 'author-two')).toBeNull();
          await expect(
            repository.update({ ...original, authorId: 'author-two' })
          ).rejects.toThrow('another developer');
          await expect(
            repository.remove(original.id, 'author-two')
          ).rejects.toThrow('another developer');
          const edited = {
            ...original,
            body: createFeedbackBody(`${body}\n\n## Improvement`),
            title: 'Board polish',
          };
          await repository.update(edited);
          expect(await repository.read(original.id, original.authorId)).toEqual(
            edited
          );
          await repository.remove(original.id, original.authorId);
          expect(await repository.list(original.authorId)).toEqual([]);
          await expect(repository.create(original)).rejects.toThrow(
            'unavailable'
          );
          expect(
            await repository.read(original.id, original.authorId)
          ).toBeNull();
          expect(await repository.list('author-two')).toHaveLength(1);
          if (mode === 'github') {
            expect(
              external.requests.find((r) => r.method === 'PATCH')?.body['title']
            ).toBe('Board polish');
            expect(
              external.requests.find((r) => r.method === 'PATCH')?.body['body']
            ).toContain(
              `Structured feedback bundle: https://example.com/api/feedback/reports/${original.id}`
            );
            expect(external.requests.at(-1)?.body['variables']).toEqual({
              id: 'issue-node',
            });
          }
        }
      )
    );
  }
);

test('the same HTTP data port supports complete CRUD and rejects a foreign authorship scope', async () => {
  const { clock, timers } = createHarnessClock();
  const store = new ObjectStoreImplInMemory();
  const handler = createFeedbackHttpApp({
    clock,
    store,
    allowedOrigin: 'http://local',
    reporter: new FileSystemIssueReporter(store),
  });
  const port = new HttpIssueReporter({
    endpoint: 'http://local/api/feedback',
    timers,
    http: { fetch: (input, init) => handler(new Request(input, init)) },
  });
  const original = report(
    'report-one',
    'author-one',
    '# Observation\n\nKeep [this](https://example.com) exactly.'
  );
  await port.create(original);
  expect((await port.list(original.authorId))[0]?.body).toEqual(original.body);
  expect(await port.read(original.id, 'author-two')).toBeNull();
  await expect(port.remove(original.id, 'author-two')).rejects.toThrow();
  const upload = createEvidenceUploader({
    timers,
    endpoint: 'http://local/api/feedback',
    createId: () => '73866a17-20db-4cd4-9a86-65c29bd3fd90',
    http: { fetch: (input, init) => handler(new Request(input, init)) },
  });
  const receipt = await upload({
    name: 'board.png',
    contentType: 'image/png',
    bytes: new Uint8Array([1, 2]),
  });
  await port.update({
    ...original,
    attachments: [{ ...receipt, url: 'https://wrong.example/file' }],
    title: 'Updated observation',
    body: createFeedbackBody('New writing'),
  });
  expect((await port.read(original.id, original.authorId))?.title).toBe(
    'Updated observation'
  );
  expect(
    (await port.read(original.id, original.authorId))?.attachments
  ).toEqual([receipt]);
  await port.remove(original.id, original.authorId);
  expect(await port.list(original.authorId)).toEqual([]);
  expect(clock.pendingOneShotCount()).toBe(0);
});
