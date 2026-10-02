import { describe, expect, test } from 'bun:test';
import { REPORT_READY } from '@libs/harness/ci/report-ready';
import { createReportPublisher } from './check-report-stream';

const A = '@libs/a#test:spec:0';
const B = '@libs/b#test:spec:1';
const C = '@pkgs/c#test:spec:0';
const event = (source: string, text = REPORT_READY) =>
  JSON.stringify({ source, text, level: 'stdout' });

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('overlapping report uploads', () => {
  test('starts before Turbo finishes, bounds concurrency and drains every queued upload', async () => {
    const waits = new Map([A, B, C].map((id) => [id, deferred()]));
    const started: string[] = [];
    const publisher = createReportPublisher(
      [A, B, C],
      {
        publish: (id) => {
          started.push(id);
          return waits.get(id)!.promise;
        },
        log() {},
      },
      2
    );
    publisher.line(event(A));
    publisher.line(event(B));
    publisher.line(event(C));
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
    const publisher = createReportPublisher([A], {
      async publish(id) {
        published.push(id);
      },
      log() {},
    });
    publisher.line(event(A, 'cache hit, replaying logs abc123'));
    publisher.line(event(A));
    await publisher.finish();
    expect(published).toEqual([A]);
  });

  test('a red check still publishes its completed report', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher([A], {
      async publish(id) {
        published.push(id);
      },
      log() {},
    });
    publisher.line(event(A, 'runner failed'));
    publisher.line(event(A));
    await publisher.finish(true);
    expect(published).toEqual([A]);
  });

  test('upload failures fail the shard while other completed suites still publish', async () => {
    const published: string[] = [];
    const publisher = createReportPublisher(
      [A, B],
      {
        async publish(id) {
          published.push(id);
          if (id === A) throw new Error('upload failed');
        },
        log() {},
      },
      1
    );
    publisher.line(event(A));
    publisher.line(event(B));
    await expect(publisher.finish()).rejects.toThrow(
      'Report publication failed'
    );
    expect(published).toEqual([A, B]);
  });

  test('a missing completion or malformed stream cannot give a green verdict', async () => {
    const publisher = createReportPublisher([A], {
      async publish() {},
      log() {},
    });
    publisher.line('not JSON');
    await expect(publisher.finish()).rejects.toThrow(
      'Report publication failed'
    );
  });
});
