/**
 * The reports screen over a reports API: every published commit, newest
 * first, and one commit's report streamed into the viewer. The host owns the
 * URL (`sha` in, `onOpen` out) and injects transport and time.
 */

import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import { createSignal, For, onCleanup, onMount, Show } from 'solid-js';

import { HarnessReportApp } from '../app/report-app';
import { fmtDate, fmtMs } from '../lib/format';
import type { CommitPage, CommitRecord } from './protocol';
import { createRemoteReport } from './remote-report';
import '../styles.css';

export type RemoteReportsAppProps = {
  readonly http: HttpClient;
  readonly timers: Timers;
  /** The reports API root (`https://api.example.com/api/reports`). */
  readonly apiBase: string;
  /** The commit shown, or null for the list of commits. */
  readonly sha: string | null;
  readonly onOpen: (sha: string | null) => void;
};

export function RemoteReportsApp(props: RemoteReportsAppProps) {
  return (
    <Show when={props.sha} keyed fallback={<CommitList {...props} />}>
      {(sha) => <CommitReport {...props} sha={sha} />}
    </Show>
  );
}

function CommitReport(props: RemoteReportsAppProps & { readonly sha: string }) {
  const remote = createRemoteReport({
    http: props.http,
    timers: props.timers,
    apiBase: props.apiBase,
    sha: props.sha,
  });
  onCleanup(() => remote.dispose());
  return (
    <HarnessReportApp
      data={remote.data}
      frameCss={remote.frameCss()}
      loader={remote.loader}
      home={{ label: 'Reports', onOpen: () => props.onOpen(null) }}
    />
  );
}

function commitStatus(commit: CommitRecord): string {
  return commit.state === 'running' ? 'running' : (commit.status ?? 'passed');
}

function CommitRow(props: {
  readonly commit: CommitRecord;
  readonly onOpen: (sha: string) => void;
}) {
  const c = () => props.commit;
  const open = () => props.onOpen(c().sha);
  return (
    <div
      class="sr-row"
      role="link"
      tabindex="0"
      aria-label={`Open the report of ${c().sha.slice(0, 9)}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        open();
      }}
    >
      <span
        class="sr-dot"
        classList={{
          passed: commitStatus(c()) === 'passed',
          failed: commitStatus(c()) === 'failed',
          skipped:
            commitStatus(c()) === 'skipped' || commitStatus(c()) === 'running',
        }}
      />
      <div>
        <div class="title mono">{`${c().sha.slice(0, 9)} · ${c().branch}`}</div>
        <div class="sub">
          <span>{fmtDate(c().startedAtMs)}</span>
          <span>{` · ${commitStatus(c())}`}</span>
          <Show when={c().frames}>
            <span> · snapshots</span>
          </Show>
        </div>
      </div>
      <span class="sr-badge">
        <Show when={c().runUrl} fallback="—">
          {(href) => (
            <a
              href={href()}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              run
            </a>
          )}
        </Show>
      </span>
      <span class="dur">
        {c().endedAtMs === null
          ? '…'
          : fmtMs((c().endedAtMs ?? 0) - c().startedAtMs)}
      </span>
    </div>
  );
}

function CommitList(props: RemoteReportsAppProps) {
  const [commits, setCommits] = createSignal<readonly CommitRecord[]>([]);
  const [cursor, setCursor] = createSignal<string | null>(null);
  const [state, setState] = createSignal<
    'loading' | 'ready' | 'error' | 'unconfigured'
  >('loading');
  const controller = new AbortController();
  onCleanup(() => controller.abort());

  const fetchPage = async (after: string | null): Promise<void> => {
    setState('loading');
    try {
      const query =
        after === null ? '' : `?cursor=${encodeURIComponent(after)}`;
      const response = await props.http.fetch(`${props.apiBase}${query}`, {
        signal: controller.signal,
      });
      if (response.status === 503) {
        setState('unconfigured');
        return;
      }
      if (!response.ok) throw new Error(String(response.status));
      const page = (await response.json()) as CommitPage;
      setCommits((prev) =>
        after === null ? page.commits : [...prev, ...page.commits]
      );
      setCursor(page.cursor);
      setState('ready');
    } catch {
      if (!controller.signal.aborted) setState('error');
    }
  };
  onMount(() => void fetchPage(null));

  return (
    <div class="harness-report-root sr-app">
      <header class="sr-header">
        <h1>Spec reports</h1>
        <span class="sr-meta">every spec of a commit, newest first</span>
        <span class="sr-spacer" />
        <button
          type="button"
          class="sr-navbtn"
          onClick={() => void fetchPage(null)}
        >
          Refresh
        </button>
      </header>
      <div class="sr-content sr-content-scroll">
        <div class="sr-list">
          <Show when={state() === 'error'}>
            <div class="sr-empty">Could not reach the reports API.</div>
          </Show>
          <Show when={state() === 'unconfigured'}>
            <div class="sr-empty">
              This deployment has no reports credential, so it cannot read the
              reports store.
            </div>
          </Show>
          <Show when={state() === 'ready' && commits().length === 0}>
            <div class="sr-empty">No commit has a report yet.</div>
          </Show>
          <div class="sr-group">
            <For each={commits()}>
              {(commit) => (
                <CommitRow
                  commit={commit}
                  onOpen={(sha) => props.onOpen(sha)}
                />
              )}
            </For>
          </div>
          <Show when={state() === 'loading'}>
            <div class="sr-empty">Loading…</div>
          </Show>
          <Show when={state() === 'ready' ? cursor() : null}>
            {(after) => (
              <button
                type="button"
                class="sr-navbtn"
                onClick={() => void fetchPage(after())}
              >
                Older reports
              </button>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}
