import type { Session } from '@pkgs/harness';
import { readBytes } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { startFeedbackRuntime } from '../client/feedback-runtime';
import { HttpIssueReporter } from '../client/http-issue-reporter';
import { mountFeedback } from '../client/mount-feedback';
import { requestFeedback } from '../client/open-feedback';
import type { FeedbackWorkspaceSnapshot } from '../shared/workspace';
import { mountExampleCommands } from './example-commands';
import { createExampleEditor } from './example-editor';
import { createExampleNavigation } from './example-navigation';
// Compile the example's lazy UI before a run; application bootstrap stays lazy.
import '../client/reporting-surface';
import { createEvidenceUploader } from '../client/upload-evidence';
import { createFeedbackHttpApp } from '../server/feedback-http-app';
import { FileSystemIssueReporter } from '../server/filesystem-issue-reporter';
import type {
  DiagnosticProvider,
  FeedbackDraft,
  FeedbackReport,
} from '../shared/types';

export type ApplicationCondition =
  | 'working'
  | 'loading'
  | 'crashed'
  | 'router'
  | 'auth'
  | 'offline'
  | 'delivery-fails';
export type DiagnosticsCondition = 'available' | 'throws' | 'hangs';
export function createExampleApp(session: Session) {
  const editor = createExampleEditor(session);
  const navigation = createExampleNavigation(session);
  const store = new ObjectStoreImplInMemory();
  let root: ReturnType<typeof mountFeedback> | null = null;
  let host: HTMLElement | null = null;
  let application: HTMLElement | null = null;
  let lastReportId = '';
  let snapshot: FeedbackWorkspaceSnapshot | null = null;
  let width = 1200;
  let foreignRefusal = false;
  let commands: HTMLElement | null = null;
  let unmountCommands: (() => void) | null = null;
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
      if (
        new URL(request.url).pathname === '/api/feedback' &&
        request.method === 'POST'
      )
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
    const node =
      host?.querySelector<HTMLElement>(`[data-testid="${id}"]`) ??
      document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!node) throw new Error(`Feedback control missing: ${id}`);
    return node;
  }
  function close() {
    unmountCommands?.();
    unmountCommands = null;
    commands?.remove();
    commands = null;
    root?.dispose();
    root = null;
    host = null;
    application?.remove();
    application = null;
  }
  function bootApplication(condition: ApplicationCondition = 'working'): void {
    close();
    deliveryFails = condition === 'delivery-fails';
    host = document.createElement('aside');
    document.body.append(host);
    application = document.createElement('button');
    application.textContent = 'Ask for a hint';
    application.dataset['testid'] = 'example-hint';
    document.body.append(application);
    commands = document.createElement('div');
    document.body.append(commands);
    unmountCommands = mountExampleCommands(commands, session);
    const mountedHost = host;
    startFeedbackRuntime({
      installFeedback(diagnostics) {
        root = mountFeedback({
          window,
          document,
          host: mountedHost,
          diagnostics,
          reporter,
          providers,
          authorId: 'local',
          evidence: store.withPrefix('drafts'),
          workspace: {
            load: () => snapshot,
            save: (value) => {
              snapshot = structuredClone(value);
            },
          },
          layout: { width, height: 900 },
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
      startApplication() {
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
    await root?.controller.ready;
    await session.waitForIdle();
  }
  async function open() {
    await ready();
    requestFeedback(document);
    await session.waitForIdle();
  }
  async function describe(draft: FeedbackDraft) {
    await ready();
    if (!root?.controller.state().visible) await open();
    root?.controller.setStage('write');
    root?.controller.setDraft({ body: draft.body, kind: draft.kind });
    for (const key of ['title'] as const) {
      const input = element(`feedback-${key}`).querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >('input, textarea');
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
  function answer(field: 'body' | 'title') {
    if (field === 'body') return editor.field();
    const input = element(`feedback-${field}`).querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >('input, textarea');
    if (!input) throw new Error('Feedback field missing');
    return input;
  }
  async function editAnswer(input: { field: 'body' | 'title'; text: string }) {
    root?.controller.setStage('write');
    if (input.field === 'body') {
      for (const character of input.text) await editor.append(character);
      return;
    }
    const field = answer(input.field);
    if (!(field instanceof HTMLInputElement))
      throw new Error('Title field missing');
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
    for (const character of input.text) {
      field.setRangeText(
        character,
        field.selectionStart ?? 0,
        field.selectionEnd ?? 0,
        'end'
      );
      field.dispatchEvent(
        new InputEvent('input', { bubbles: true, data: character })
      );
      await session.waitForIdle();
    }
  }
  async function enterTemplateCommand(command: string) {
    root?.controller.setStage('write');
    await editor.write(
      `${root?.controller.state().draft.body ?? ''}\n\n${command}`.trim()
    );
    await editor.key('Enter');
  }
  async function record(stop: boolean) {
    await ready();
    root?.controller.open('problem');
    root?.controller.setStage('write');
    element('feedback-record').click();
    await idle();
    application?.click();
    application?.click();
    if (stop) {
      element('feedback-stop').click();
      await idle();
    }
  }
  async function managementAction(action: {
    type: string;
    title?: string;
    body?: string;
  }) {
    if (action.type === 'palette') {
      element('example-commands').click();
      await session.waitForIdle();
      const option =
        document.querySelector<HTMLButtonElement>('[role="option"]');
      if (!option) throw new Error('Feedback command unavailable');
      option.click();
    }
    if (action.type === 'edit') {
      const id = root?.controller.workspace.state().activeId;
      await root?.controller.manage();
      element(`feedback-open-${id}`).click();
      await session.waitForIdle();
      element(`feedback-edit-${id}`).click();
      await session.waitForIdle();
      await describe({
        title: action.title ?? '',
        body: action.body ?? '',
        kind: 'problem',
      });
      await send();
    }
    if (action.type === 'delete' || action.type === 'cancel-delete') {
      const id = root?.controller.workspace.state().activeId;
      await root?.controller.manage();
      element(`feedback-open-${id}`).click();
      await session.waitForIdle();
      element(`feedback-delete-${id}`).click();
      await session.waitForIdle();
      if (action.type === 'delete') {
        element('feedback-delete-confirm').click();
        await idle();
      } else {
        const cancel = [
          ...document.querySelectorAll<HTMLButtonElement>(
            '[role="dialog"] button'
          ),
        ].find((button) => button.textContent.includes('Cancel'));
        if (!cancel) throw new Error('Cancel unavailable');
        cancel.click();
      }
    }
  }
  return {
    store,
    editor,
    navigation,
    async wizard(action: { type: string; title?: string; body?: string }) {
      await ready();
      if (action.type === 'close') root?.controller.close();
      if (action.type === 'return') {
        root?.controller.close();
        await open();
      }
      if (action.type === 'reopen') {
        bootApplication();
        await ready();
        await open();
      }
      if (action.type === 'new') await root?.controller.newDraft();
      if (action.type === 'manage') {
        await root?.controller.manage();
        await open();
      }
      if (action.type === 'bug-template') {
        await open();
        await enterTemplateCommand('/bug');
      }
      if (action.type === 'polish-template') {
        await open();
        await enterTemplateCommand('/polish');
      }
      if (action.type === 'phone') {
        width = 390;
        bootApplication();
        await ready();
      }
      if (action.type === 'move') {
        element('feedback-drag').dispatchEvent(
          new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })
        );
      }
      await managementAction(action);
      await session.waitForIdle();
    },
    async foreign(title: string) {
      const draft = {
        kind: 'problem' as const,
        title,
        body: 'Private observation',
      };
      await server(
        new Request('http://local/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...draft,
            id: 'foreign-report',
            authorId: 'another-developer',
            recording: null,
            attachments: [],
            diagnostics: [],
          }),
        })
      );
    },
    async tryForeignEdit() {
      const response = await server(
        new Request('http://local/api/feedback/items/foreign-report', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Feedback-Author': 'local',
          },
          body: JSON.stringify({ title: 'Changed', body: 'Changed' }),
        })
      );
      foreignRefusal = response.status === 404;
    },
    foreignRefusal: () => foreignRefusal,
    boot: bootApplication,
    ready,
    open,
    describe,
    send,
    editAnswer,
    readAnswer(field: 'body' | 'title') {
      const input = answer(field);
      return {
        value:
          field === 'body'
            ? root?.controller.state().draft.body
            : (input as HTMLInputElement).value,
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
    async submit(title: string, body: string) {
      await describe({
        kind: 'problem',
        title,
        body,
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
    emergencyReport: () => root?.controller.emergencyCopy() ?? null,
    view: () => ({
      text: host?.textContent ?? '',
      draft: root?.controller.state().draft ?? null,
      wizardCount: document.querySelectorAll(
        '[data-testid="feedback-surface"], [data-testid="feedback-widget"]'
      ).length,
      permanentControl:
        document.querySelector('[data-testid="feedback-open"]') !== null,
      sheet: (() => {
        const surface = document.querySelector(
          '[data-testid="feedback-surface"]'
        );
        return (
          surface?.classList.contains('left-0') === true &&
          surface.classList.contains('right-0')
        );
      })(),
      position: root?.controller.workspace.state().position,
      managementText:
        document.querySelector('[data-testid="feedback-management"]')
          ?.textContent ?? '',
      stage: root?.controller.workspace.state().stage,
      heading: host?.querySelector('h2')?.textContent ?? '',
      hasContextScreen:
        document.querySelector('[data-component="FeedbackContext"]') !== null,
      hasAttachControl:
        document.querySelector('[data-testid="feedback-attach"]') !== null,
      hasRecordControl:
        document.querySelector('[data-testid="feedback-record"]') !== null,
      buttons: [...(host?.querySelectorAll('button') ?? [])]
        .map((button) => button.textContent.trim())
        .filter(Boolean),
      recording: root?.controller.recorder.state() ?? null,
      videoStarts,
      errors: root?.controller.state().errors ?? {},
    }),
  };
}
