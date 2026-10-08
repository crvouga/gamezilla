import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { ReportNavigation } from '@pkgs/harness-report-client/navigation';
import { RemoteReportsApp } from '@pkgs/harness-report-client/remote-reports-app';
import {
  type CommitRecord,
  encodeSseEvent,
} from '@pkgs/harness-report-shared/protocol';
import type { RunReport } from '@pkgs/harness-root-shared/report-types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { TestProviders } from './test-providers';

export const SHA = 'e14700dd1b0ee11714b01b80fc2a8126f81bb61c';
export const OTHER_SHA = 'f7860c833225d95c0be08d944f8beb3c5c1c68da';
export const TEST_HASH =
  '#/test/libs-billing-harness--part-0%2Fci-interruption?tab=tests';

const commit: CommitRecord = {
  sha: SHA,
  branch: 'feat/game-ui-overhaul',
  runUrl: null,
  state: 'complete',
  startedAtMs: 0,
  endedAtMs: 1,
  status: 'failed',
};
const interruption: RunReport = {
  meta: {
    system: 'check',
    runtime: 'local',
    seed: '0',
    startedAtMs: 0,
    endedAtMs: 0,
    durationMs: 0,
    status: 'failed',
    runId: 'specs',
    testId: 'ci-interruption',
    title: 'Check interrupted: @libs/billing-harness#test:spec:0',
    actorIds: [],
    error:
      'Check exited 124 before receiving a verdict for @libs/billing-harness#test:spec:0.',
  },
  steps: [],
};
const source = {
  source: 'libs-billing-harness--part-0',
  packageDir: 'libs/billing-harness',
  bucket: 'part-0',
  status: 'failed' as const,
  updatedAtMs: 0,
  tests: [interruption.meta],
};

function fixtureHttp(): HttpClient {
  return {
    fetch(input) {
      const path = new URL(String(input)).pathname;
      if (path === '/api/reports')
        return Promise.resolve(
          Response.json({
            commits: [
              commit,
              { ...commit, sha: OTHER_SHA, branch: 'feat/report-test-history' },
            ],
            cursor: null,
          })
        );
      if (path.endsWith('/sources'))
        return Promise.resolve(Response.json({ sources: [source] }));
      if (path.endsWith('/explorer'))
        return Promise.resolve(Response.json({ inventory: null, parts: [] }));
      if (path.endsWith('/frame.css')) return Promise.resolve(new Response(''));
      if (path.endsWith('/events'))
        return Promise.resolve(
          new Response(
            [
              encodeSseEvent({
                type: 'commit',
                commit: {
                  ...commit,
                  sha: path.split('/')[3] ?? SHA,
                },
              }),
              encodeSseEvent({ type: 'source', source }),
              encodeSseEvent({ type: 'end', state: 'complete' }),
            ].join('')
          )
        );
      if (path.endsWith('/tests/libs-billing-harness--part-0/ci-interruption'))
        return Promise.resolve(Response.json(interruption));
      throw new Error(`Unexpected reports fixture request: ${path}`);
    },
  };
}

export async function settleReport(): Promise<void> {
  for (let turn = 0; turn < 60; turn += 1) await Promise.resolve();
}

export function mountReport(width: number, initialHash: string) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const [sha, setSha] = createSignal<string | null>(SHA);
  const { timers } = createHarnessClock();
  let hash = initialHash;
  const opened: (string | null)[] = [];
  const navigation: ReportNavigation = {
    readHash: () => hash,
    writeHash: (next) => {
      hash = next;
    },
    subscribeHash: () => () => undefined,
    subscribeKeys: (listener) => {
      document.addEventListener('keydown', listener);
      return () => document.removeEventListener('keydown', listener);
    },
    setTitle: () => undefined,
  };
  const dispose = render(
    () => (
      <TestProviders width={width}>
        <RemoteReportsApp
          http={fixtureHttp()}
          timers={timers}
          navigation={navigation}
          apiBase="https://example.test/api/reports"
          sha={sha()}
          onOpen={(next) => {
            opened.push(next);
            hash = '#/?tab=tests';
            setSha(next);
          }}
        />
      </TestProviders>
    ),
    host
  );
  return {
    host,
    opened,
    readHash: () => hash,
    dispose: () => {
      dispose();
      host.remove();
    },
  };
}
