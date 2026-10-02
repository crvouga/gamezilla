import { describe, expect, test } from 'bun:test';
import { REPORT_READY } from '@libs/harness/ci/report-ready';
import { createReportPublisher } from './check-report-stream';

const A = '@libs/a#test:spec:0';
const B = '@libs/b#test:spec:1';
const C = '@pkgs/c#test:spec:0';
const HASH = '0123456789abcdef';
const tasks = (...ids: string[]) =>
  ids.map((taskId) => ({ taskId, hash: HASH }));
const event = (source: string, text = REPORT_READY) =>
  JSON.stringify({ source, text, level: 'stdout' });

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function completed(
  publisher: ReturnType<typeof createReportPublisher>,
  taskId: string
) {
  publisher.line(event(taskId, `cache miss, executing ${HASH}`));
  publisher.line(event(taskId));
}

describe('overlapping report uploads', () => {
  test('starts before Turbo finishes, bounds concurrency and drains every queued upload', async () => {
    const waits = new Map([A, B, C].map((id) => [id, deferred()]));
    const started: string[] = [];
    const publisher = createReportPublisher(
      tasks(A, B, C),
      {
        publish: (id) => {
          started.push(id);
          return waits.get(id)!.promise;
        },
        log() {},
      },
      2
    );
    completed(publisher, A);
    completed(publisher, B);
    completed(publisher, C);
    publisher.line(event(A));
    publisher.line(event('@libs/unassigned#test:spec:0'));
    expect(started).toEqual([A, B]);
    waits.get(A)!.resolve();
    await waits.get(A)!.promise;
    await Promise.resolve();
    expect(started).toEqual([A, B, C]);
    let finished = false;
    const finish = publisher.finish().then(() => {
      finished = true;
    });
    expect(finished).toBe(false);
    waits.get(B)!.resolve();
    waits.get(C)!.resolve();
    await finish;
    expect(finished).toBe(true);
  });

  test('cached outputs publish once without rerunning the suite or needing a new marker', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher(tasks(A), {
      async publish(id) {
        published.push(id);
      },
      log() {},
    });
    publisher.line(event(A, `cache hit, replaying logs ${HASH}`));
    publisher.line(event(A));
    await publisher.finish();
    expect(published).toEqual([A]);
  });

  test('a red check still publishes its completed report', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher(tasks(A), {
      async publish(id) {
        published.push(id);
      },
      log() {},
    });
    publisher.line(event(A, 'runner failed'));
    completed(publisher, A);
    await publisher.finish(true);
    expect(published).toEqual([A]);
  });

  test('upload failures fail the shard while other completed suites still publish', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher(
      tasks(A, B),
      {
        async publish(id) {
          published.push(id);
          if (id === A) throw new Error('upload failed');
        },
        log() {},
      },
      1
    );
    completed(publisher, A);
    completed(publisher, B);
    await expect(publisher.finish()).rejects.toThrow(
      'Report publication failed'
    );
    expect(published).toEqual([A, B]);
  });

  test('a missing completion or malformed stream cannot give a green verdict', async () => {
    const publisher = createReportPublisher(tasks(A), {
      async publish() {},
      log() {},
    });
    publisher.line('not JSON');
    await expect(publisher.finish()).rejects.toThrow(
      'Report publication failed'
    );
  });

  // regression: report-plan-hash-drift
  test('a changed execution hash cannot publish evidence under the planned hash', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher(tasks(A), {
      async publish(id) {
        published.push(id);
      },
      log() {},
    });
    publisher.line(event(A, 'cache miss, executing fedcba9876543210'));
    publisher.line(event(A));
    await expect(publisher.finish()).rejects.toThrow(
      'Report publication failed'
    );
    expect(published).toEqual([]);
  });
});
