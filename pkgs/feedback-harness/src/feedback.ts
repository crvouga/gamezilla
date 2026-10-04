import { defineAction } from '@pkgs/harness-shared/define-action';
import { defineRuntime } from '@pkgs/harness-shared/define-runtime';
import { defineSystem } from '@pkgs/harness-shared/define-system';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import { virtualTimeRuntime } from '@pkgs/harness-shared/virtual-time-runtime';
import type { ApplicationCondition, DiagnosticsCondition } from './example-app';
import { createExampleApp } from './example-app';

export type FeedbackReportingWorld = {
  readonly session: Session;
  readonly app: ReturnType<typeof createExampleApp>;
};
export const applicationCondition = defineAction({
  name: 'applicationCondition',
  act: (world: FeedbackReportingWorld, condition: ApplicationCondition) =>
    world.app.boot(condition),
});
export const diagnosticsCondition = defineAction({
  name: 'diagnosticsCondition',
  act: (world: FeedbackReportingWorld, condition: DiagnosticsCondition) =>
    world.app.setDiagnostics(condition),
});
export const submitReport = defineAction({
  name: 'submitReport',
  act: (
    world: FeedbackReportingWorld,
    input: { title: string; body: string }
  ) => world.app.submit(input.title, input.body),
});
export const feedbackAction = defineAction({
  name: 'feedbackAction',
  act: async (
    world: FeedbackReportingWorld,
    action: {
      type:
        | 'open'
        | 'describe'
        | 'send'
        | 'record'
        | 'start'
        | 'stop'
        | 'discard'
        | 'no-video';
      draft?: import('@pkgs/feedback-shared/types').FeedbackDraft;
    }
  ) => {
    if (action.type === 'open') await world.app.open();
    if (action.type === 'describe' && action.draft)
      await world.app.describe(action.draft);
    if (action.type === 'send') await world.app.send();
    if (action.type === 'record') await world.app.record(true);
    if (action.type === 'start') await world.app.record(false);
    if (action.type === 'stop') await world.app.stop();
    if (action.type === 'discard') await world.app.discard();
    if (action.type === 'no-video') world.app.setVideoAvailable(false);
  },
});
export const readFeedbackView = (world: FeedbackReportingWorld) =>
  world.app.view();
export const editorAction = defineAction({
  name: 'editorAction',
  act: async (
    world: FeedbackReportingWorld,
    input: { type: 'write' | 'key' | 'format'; text: string }
  ) => {
    if (input.type === 'write') await world.app.editor.write(input.text);
    if (input.type === 'key') await world.app.editor.key(input.text);
    if (input.type === 'format') await world.app.editor.format(input.text);
  },
});
export const readEditorView = (world: FeedbackReportingWorld) =>
  world.app.editor.view();
export const navigationAction = defineAction({
  name: 'navigationAction',
  act: async (
    world: FeedbackReportingWorld,
    input: { type: 'open' | 'focus' | 'key'; text: string; key?: string }
  ) => {
    if (input.type === 'open') await world.app.navigation.openIssue(input.text);
    if (input.type === 'focus')
      await world.app.navigation.focusIcon(input.text);
    if (input.type === 'key')
      await world.app.navigation.key({
        label: input.text,
        key: input.key ?? 'Escape',
      });
  },
});
export const readNavigationView = (world: FeedbackReportingWorld) =>
  world.app.navigation.view();
export const editFeedbackAnswer = defineAction({
  name: 'editFeedbackAnswer',
  act: (
    world: FeedbackReportingWorld,
    input: Parameters<FeedbackReportingWorld['app']['editAnswer']>[0]
  ) => world.app.editAnswer(input),
});
export const readFeedbackAnswer = (
  world: FeedbackReportingWorld,
  field: 'body' | 'title'
) => world.app.readAnswer(field);
export const closeApplication = defineAction({
  name: 'closeApplication',
  act: (world: FeedbackReportingWorld) => world.app.close(),
});
export const readReport = (world: FeedbackReportingWorld) => world.app.report();
export const readEmergencyReport = (world: FeedbackReportingWorld) =>
  world.app.emergencyReport();
export const wizardAction = defineAction({
  name: 'wizardAction',
  act: (
    world: FeedbackReportingWorld,
    input: Parameters<FeedbackReportingWorld['app']['wizard']>[0]
  ) => world.app.wizard(input),
});
export const foreignFeedback = defineAction({
  name: 'foreignFeedback',
  act: (world: FeedbackReportingWorld, title: string) =>
    world.app.foreign(title),
});
export const changeForeignFeedback = defineAction({
  name: 'changeForeignFeedback',
  act: (world: FeedbackReportingWorld) => world.app.tryForeignEdit(),
});
export const readForeignRefusal = (world: FeedbackReportingWorld) =>
  world.app.foreignRefusal();
export const feedbackReportingSystem = defineSystem<FeedbackReportingWorld>({
  name: 'feedback',
  async create(session) {
    const app = createExampleApp(session);
    app.boot();
    await app.ready();
    session.onDispose(() => app.close());
    return { session, app };
  },
  runtimes: [
    defineRuntime({
      name: 'virtual',
      default: true,
      create: () => virtualTimeRuntime(),
    }),
  ],
  actions: [
    applicationCondition,
    diagnosticsCondition,
    submitReport,
    closeApplication,
    feedbackAction,
    editFeedbackAnswer,
    editorAction,
    navigationAction,
    wizardAction,
    foreignFeedback,
    changeForeignFeedback,
  ],
});
