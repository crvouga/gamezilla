import type { Session } from '@pkgs/harness';
import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { HttpIssueReporter } from '../client/http-issue-reporter';
import { mountRootReporting } from '../client/mount-root-reporting';
import { startRootRuntime } from '../client/root-runtime';
// Compile the example's lazy UI before a run; production bootstrap stays lazy.
import '../client/reporting-surface';
import { createEvidenceUploader } from '../client/upload-evidence';
import { createFeedbackHttpApp } from '../server/feedback-http-app';
import { FileSystemIssueReporter } from '../server/filesystem-issue-reporter';
import type {
  DiagnosticProvider,
  FeedbackDraft,
  FeedbackReport,
} from '../shared/types';

export type ProductCondition =
  | 'working'
  | 'loading'
  | 'crashed'
  | 'router'
  | 'auth'
  | 'offline'
  | 'delivery-fails';
export type DiagnosticsCondition = 'available' | 'throws' | 'hangs';
export function createExampleApp(session: Session) {
  const store = new ObjectStoreImplInMemory();
  let root: ReturnType<typeof mountRootReporting> | null = null;
  let host: HTMLElement | null = null;
  let product: HTMLElement | null = null;
  let lastReportId = '';
  let diagnosticsCondition: DiagnosticsCondition = 'available';
  let deliveryFails = false;
  let videoAvailable = true;
  let videoStarts = 0;
  const providers: DiagnosticProvider[] = [
    'context',
    'screenshot',
    'telemetry',
  ].map((name) => ({
    name,
    collect() {
      if (diagnosticsCondition === 'throws') throw new Error('Unavailable');
      if (diagnosticsCondition === 'hangs')
        return new Promise(() => {
          /* Unavailable until the diagnostic deadline. */
        });
      return { captured: true };
    },
  }));
  const server = createFeedbackHttpApp({
    store,
    reporter: new FileSystemIssueReporter(store),
    clock: session.ports.clock,
    allowedOrigin: 'http://local',
  });
  const http = {
    async fetch(input: RequestInfo | URL, init?: RequestInit) {
      const request = new Request(input, init);
      if (new URL(request.url).pathname === '/api/feedback')
        lastReportId = ((await request.clone().json()) as FeedbackReport).id;
      return deliveryFails
        ? Response.json({ error: 'Unavailable' }, { status: 503 })
        : server(request);
    },
  };
  const reporter = new HttpIssueReporter({
    endpoint: 'http://local/api/feedback',
    timers: session.ports.timers,
    http,
  });
  async function idle() {
    await session.waitForIdle();
    await session.advanceTime(500);
    await session.waitForIdle();
  }
  function element(id: string): HTMLElement {
    const node = host?.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Feedback control missing: ${id}`);
    return node;
  }
  function close() {
    root?.dispose();
    root = null;
    host = null;
    product?.remove();
    product = null;
  }
  function boot(condition: ProductCondition = 'working') {
    close();
    deliveryFails = condition === 'delivery-fails';
    host = document.createElement('aside');
    document.body.append(host);
    product = document.createElement('button');
    product.textContent = 'Ask for a hint';
    product.dataset['testid'] = 'example-hint';
    document.body.append(product);
    const mountedHost = host;
    startRootRuntime({
      installReporting(diagnostics) {
        root = mountRootReporting({
          window,
          document,
          host: mountedHost,
          diagnostics,
          reporter,
          providers,
          ...session.ports,
          upload: createEvidenceUploader({
            endpoint: 'http://local/api/feedback',
            http,
            ...session.ports,
          }),
          video: {
            start() {
              videoStarts++;
              if (!videoAvailable)
                return Promise.reject(new Error('Unsupported'));
              return Promise.resolve({
                stop: () =>
                  Promise.resolve({
                    name: 'reproduction.webm',
                    contentType: 'video/webm',
                    bytes: new Uint8Array([1, 2, 3]),
                  }),
                dispose() {
                  /* In-process evidence port owns no native device. */
                },
              });
            },
          },
        });
      },
      startProduct() {
        if (condition === 'loading')
          return new Promise(() => {
            /* Unavailable until the diagnostic deadline. */
          });
        if (['crashed', 'router', 'auth'].includes(condition))
          throw new Error(condition);
        return Promise.resolve();
      },
    });
  }
  async function ready() {
    await root?.ready;
    await session.waitForIdle();
  }
  async function open() {
    await ready();
    element('feedback-open').click();
    await session.waitForIdle();
  }
  async function describe(draft: FeedbackDraft) {
    await ready();
    if (!root?.controller.state().visible) {
      await open();
      element(`feedback-kind-${draft.kind}`).click();
    } else root.controller.open(draft.kind);
    for (const [key, id] of [
      ['description', 'feedback-description'],
      ['expected', 'feedback-expected'],
      ['reproductionSteps', 'feedback-steps'],
    ] as const) {
      if (key === 'reproductionSteps' && draft.kind !== 'problem') continue;
      const input = element(id).querySelector<HTMLTextAreaElement>('textarea');
      if (!input) throw new Error('Feedback field missing');
      input.value = draft[key];
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
  async function send() {
    await ready();
    element('feedback-form').dispatchEvent(
      new Event('submit', { cancelable: true, bubbles: true })
    );
    await idle();
  }
  function answer(field: 'description' | 'expected' | 'steps') {
    const input = element(`feedback-${field}`).querySelector('textarea');
    if (!input) throw new Error('Feedback field missing');
    return input;
  }
  async function editAnswer(input: {
    field: 'description' | 'expected' | 'steps';
    text: string;
  }) {
    const field = answer(input.field);
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    for (const character of input.text) {
      field.setRangeText(
        character,
        field.selectionStart,
        field.selectionEnd,
        'end'
      );
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: character })
      );
      await session.waitForIdle();
    }
  }
  async function record(stop: boolean) {
    await ready();
    root?.controller.open('problem');
    element('feedback-record').click();
    await idle();
    product?.click();
    product?.click();
    if (stop) {
      element('feedback-stop').click();
      await idle();
    }
  }
  return {
    store,
    boot,
    ready,
    open,
    describe,
    send,
    editAnswer,
    readAnswer(field: 'description' | 'expected' | 'steps') {
      const input = answer(field);
      return {
        value: input.value,
        focused: document.activeElement === input,
      };
    },
    record,
    close,
    setDiagnostics(condition: DiagnosticsCondition) {
      diagnosticsCondition = condition;
    },
    setVideoAvailable(value: boolean) {
      videoAvailable = value;
    },
    stop: async () => {
      element('feedback-stop').click();
      await idle();
    },
    discard: async () => {
      element('feedback-discard').click();
      await idle();
    },
    async submit(title: string, description: string) {
      await describe({
        kind: 'problem',
        description: `${title}\n${description}`,
        expected: 'The app responds',
        reproductionSteps: 'Open the app and repeat the reported action',
      });
      await send();
    },
    async report(): Promise<FeedbackReport | null> {
      const object = await store.get(`feedback-${lastReportId}/report.json`);
      return object
        ? (JSON.parse(
            new TextDecoder().decode(await readBytes(object.body))
          ) as FeedbackReport)
        : null;
    },
    emergencyReport: () => root?.controller.state().attempted ?? null,
    view: () => ({
      text: host?.textContent ?? '',
      kinds: ['problem', 'feature', 'gap', 'polish'].filter((kind) =>
        host?.querySelector(`[data-testid="feedback-kind-${kind}"]`)
      ),
      recording: root?.controller.recorder.state() ?? null,
      videoStarts,
      errors: root?.controller.state().errors ?? {},
    }),
  };
}
