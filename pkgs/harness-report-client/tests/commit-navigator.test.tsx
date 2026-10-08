import { expect, test } from 'bun:test';
import { CommitNavigator } from '@pkgs/harness-report-client/commit-list';
import {
  type ReportFetcher,
  reportQueryClient,
} from '@pkgs/harness-report-client/fetcher';
import type { CommitPage } from '@pkgs/harness-report-shared/protocol';
import { QueryClientProvider } from '@tanstack/solid-query';
import { render } from 'solid-js/web';
import { TestProviders } from './test-providers';

const EARLIER = '1'.repeat(40);
const LATER = '2'.repeat(40);

function commitPage(): CommitPage {
  return {
    commits: [
      {
        sha: LATER,
        branch: 'main',
        runUrl: null,
        state: 'complete',
        startedAtMs: 2,
        endedAtMs: 3,
        status: 'passed',
      },
      {
        sha: EARLIER,
        branch: 'feature/reports',
        runUrl: null,
        state: 'complete',
        startedAtMs: 0,
        endedAtMs: 1,
        status: 'failed',
      },
    ],
    cursor: null,
  };
}

function fetcher(): ReportFetcher {
  const unavailable = (): never => {
    throw new Error('not used by the version navigator');
  };
  return {
    commits: () => Promise.resolve(commitPage()),
    explorer: unavailable,
    spec: unavailable,
    sources: unavailable,
    frameCss: unavailable,
    test: unavailable,
    blob: unavailable,
  };
}

async function settleQueries(): Promise<void> {
  for (let turn = 0; turn < 10; turn += 1) await Promise.resolve();
}

test('a selected report keeps other commits available for direct exploration', async () => {
  const client = reportQueryClient();
  const host = document.createElement('div');
  document.body.appendChild(host);
  const opened: string[] = [];
  const dispose = render(
    () => (
      <TestProviders>
        <QueryClientProvider client={client}>
          <CommitNavigator
            fetcher={fetcher()}
            selectedSha={LATER}
            onOpen={(sha) => {
              if (sha !== null) opened.push(sha);
            }}
          />
        </QueryClientProvider>
      </TestProviders>
    ),
    host
  );
  try {
    await settleQueries();
    const rows = host.querySelectorAll<HTMLElement>(
      '[data-testid="report-version"]'
    );
    expect(rows).toHaveLength(2);
    expect(
      host.querySelector(`[data-sha="${LATER}"]`)?.getAttribute('aria-current')
    ).toBe('true');
    host.querySelector<HTMLButtonElement>(`[data-sha="${EARLIER}"]`)!.click();
    expect(opened).toEqual([EARLIER]);
  } finally {
    dispose();
    client.clear();
    host.remove();
  }
});
