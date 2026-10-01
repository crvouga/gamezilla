import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { HttpIssueReporter } from '@pkgs/feedback/client';
import {
  ArchivedIssueReporter,
  createFeedbackHttpApp,
  FakeIssueReporter,
  FileSystemIssueReporter,
  GitHubIssueReporter,
} from '@pkgs/feedback/server';
import type { FeedbackReport, FeedbackRepository } from '@pkgs/feedback/shared';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { assertProperty, fc } from '@pkgs/property';

function report(
  id: string,
  authorId: string,
  description: string
): FeedbackReport {
  return {
    version: 1,
    id,
    authorId,
    title: 'Board movement',
    kind: 'polish',
    description,
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
            description: `${body}\n\n## Improvement`,
            title: 'Board polish',
          };
          await repository.update(edited);
          expect(await repository.read(original.id, original.authorId)).toEqual(
            edited
          );
          await repository.remove(original.id, original.authorId);
          expect(await repository.list(original.authorId)).toEqual([]);
          expect(
            await repository.read(original.id, original.authorId)
          ).toBeNull();
          expect(await repository.list('author-two')).toHaveLength(1);
          if (mode === 'github') {
            expect(
              external.requests.find((r) => r.method === 'PATCH')?.body['title']
            ).toBe('Board polish');
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
  expect((await port.list(original.authorId))[0]?.description).toBe(
    original.description
  );
  expect(await port.read(original.id, 'author-two')).toBeNull();
  await expect(port.remove(original.id, 'author-two')).rejects.toThrow();
  await port.update({
    ...original,
    title: 'Updated observation',
    description: 'New writing',
  });
  expect((await port.read(original.id, original.authorId))?.title).toBe(
    'Updated observation'
  );
  await port.remove(original.id, original.authorId);
  expect(await port.list(original.authorId)).toEqual([]);
  expect(clock.pendingOneShotCount()).toBe(0);
});
