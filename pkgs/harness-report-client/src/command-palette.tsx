import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import {
  frameHasUi,
  neighborFailure,
  selectedFrame,
  testFrames,
} from '@pkgs/harness-report-shared/frames';
import {
  showAside,
  showPress,
  viewMode,
  zoomMode,
} from '@pkgs/harness-report-shared/hash';
import type { ReportData } from '@pkgs/harness-report-shared/types';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { CommandPalette as DesignCommandPalette } from '@pkgs/ui-root-client/command-palette';
import {
  CommandRegistryProvider,
  useCommandRegistry,
} from '@pkgs/ui-root-client/command-registry-context';
import { useRegisterCommands } from '@pkgs/ui-root-client/register-command';
import { createEffect, createMemo } from 'solid-js';
import { useReport } from './report-context';
import type { ReportNav } from './use-report-nav';

type Command = {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
  readonly keywords: string;
  readonly run: () => void;
};

type CommandContext = {
  readonly data: ReportData;
  readonly nav: ReportNav;
  readonly test: HtmlReportTest | null;
  readonly route: ReturnType<ReportNav['route']>;
  readonly frame: FlatFrame | null;
};

function baseCommands(nav: ReportNav): Command[] {
  return [
    {
      id: 'tests',
      label: 'Show all tests',
      hint: 'Esc',
      keywords: 'home list tests report',
      run: () =>
        nav.navigate({
          view: 'list',
          params: catalogParams(nav.route().params),
        }),
    },
    {
      id: 'help',
      label: 'Show keyboard shortcuts',
      hint: '?',
      keywords: 'help shortcuts keyboard',
      run: () => nav.toggleHelp(),
    },
  ];
}

function timelineCommands(nav: ReportNav, test: HtmlReportTest): Command[] {
  const frames = testFrames(test);
  return [
    {
      id: 'previous-frame',
      label: 'Previous frame',
      hint: '←',
      keywords: 'back previous scrub timeline',
      run: () => nav.stepFrame(-1),
    },
    {
      id: 'next-frame',
      label: 'Next frame',
      hint: '→',
      keywords: 'forward next scrub timeline',
      run: () => nav.stepFrame(1),
    },
    {
      id: 'toggle-play',
      label: nav.playing() ? 'Pause playback' : 'Play frames',
      hint: 'Space',
      keywords: 'play pause animation timeline',
      run: () => nav.togglePlay(),
    },
    {
      id: 'next-failure',
      label: 'Jump to next failure',
      hint: 'N',
      keywords: 'failure error failed red',
      run: () => {
        const sel = selectedFrame(frames, nav.route());
        const f = neighborFailure(frames, sel ? sel.index : -1, 1);
        if (f) nav.goFrame(f);
      },
    },
    {
      id: 'first-frame',
      label: 'Jump to first frame',
      hint: 'Home',
      keywords: 'start beginning timeline',
      run: () => nav.goFrame(frames[0] ?? null),
    },
    {
      id: 'last-frame',
      label: 'Jump to last frame',
      hint: 'End',
      keywords: 'end latest timeline',
      run: () => nav.goFrame(frames[frames.length - 1] ?? null),
    },
  ];
}

function uiCommands(nav: ReportNav, route: CommandContext['route']): Command[] {
  return [
    {
      id: 'toggle-view',
      label: `Switch to ${viewMode(route) === 'multi' ? 'single' : 'multi'} view`,
      hint: 'M',
      keywords: 'clients multi single view panels',
      run: () =>
        nav.setParam('view', viewMode(route) === 'multi' ? 'single' : ''),
    },
    {
      id: 'toggle-snapshots',
      label: `${showAside(route) ? 'Hide' : 'Show'} state panel`,
      hint: 'A',
      keywords: 'aside snapshots details json text',
      run: () => nav.setParam('aside', showAside(route) ? '0' : ''),
    },
    {
      id: 'toggle-press',
      label: `${showPress(route) ? 'Hide' : 'Show'} press highlight`,
      hint: 'P',
      keywords: 'press tap click overlay gesture',
      run: () => nav.setParam('press', showPress(route) ? '0' : ''),
    },
    {
      id: 'cycle-zoom',
      label: `Zoom ${zoomMode(route) === '100' ? 'to fit' : 'in'}`,
      hint: 'F',
      keywords: 'zoom fit scale size',
      run: () => {
        const order = ['fit', '50', '75', '100'];
        const next =
          order[(order.indexOf(zoomMode(route)) + 1) % order.length] ?? 'fit';
        nav.setParam('zoom', next === 'fit' ? '' : next);
      },
    },
  ];
}

function testCommands(nav: ReportNav, data: ReportData): Command[] {
  const params = catalogParams(nav.route().params);
  return data.tests.map((test) => ({
    id: `test:${test.report.meta.testId}`,
    label: `Open ${test.report.meta.title}`,
    hint: test.report.meta.status,
    keywords: `${test.report.meta.title} ${test.report.meta.testId} ${test.report.meta.sourceFile ?? ''}`,
    run: () =>
      nav.navigate({
        view: 'test',
        testId: test.report.meta.testId,
        params,
      }),
  }));
}

function moveTestCommands(nav: ReportNav, data: ReportData): Command[] {
  const route = nav.route();
  if (route.view !== 'test') return [];
  const index = data.tests.findIndex(
    (test) => test.report.meta.testId === route.testId
  );
  const params = catalogParams(route.params);
  const commands: Command[] = [];
  const prev = data.tests[index - 1];
  const next = data.tests[index + 1];
  if (prev) {
    commands.push({
      id: 'previous-test',
      label: `Previous test: ${prev.report.meta.title}`,
      hint: '[',
      keywords: 'previous test back report',
      run: () =>
        nav.navigate({
          view: 'test',
          testId: prev.report.meta.testId,
          params,
        }),
    });
  }
  if (next) {
    commands.push({
      id: 'next-test',
      label: `Next test: ${next.report.meta.title}`,
      hint: ']',
      keywords: 'next test forward report',
      run: () =>
        nav.navigate({
          view: 'test',
          testId: next.report.meta.testId,
          params,
        }),
    });
  }
  return commands;
}

function buildCommands(ctx: CommandContext): Command[] {
  const commands = baseCommands(ctx.nav);
  if (ctx.test && ctx.route.view === 'test') {
    commands.push(...timelineCommands(ctx.nav, ctx.test));
    commands.push(...moveTestCommands(ctx.nav, ctx.data));
    if (frameHasUi(ctx.frame)) commands.push(...uiCommands(ctx.nav, ctx.route));
  }
  commands.push(...testCommands(ctx.nav, ctx.data));
  return commands;
}

function RegisteredPalette(props: {
  nav: ReportNav;
  commands: () => Command[];
}) {
  const registry = useCommandRegistry();
  useRegisterCommands(() =>
    props.commands().map((command) => ({
      id: command.id,
      title: command.label,
      subtitle: command.hint,
      keywords: command.keywords.split(' '),
      run: () => {
        props.nav.closePalette();
        command.run();
      },
    }))
  );
  createEffect(() => {
    if (props.nav.showPalette()) registry.open();
  });
  createEffect(() => {
    if (!registry.isOpen()) props.nav.closePalette();
  });
  return <DesignCommandPalette />;
}

export function CommandPalette(props: { nav: ReportNav }) {
  const report = useReport();
  const currentTest = createMemo(() => {
    const route = props.nav.route();
    return route.view === 'test'
      ? (report.data.tests.find(
          (test) => test.report.meta.testId === route.testId
        ) ?? null)
      : null;
  });
  const currentFrame = createMemo(() => {
    const test = currentTest();
    const route = props.nav.route();
    return test && route.view === 'test'
      ? selectedFrame(testFrames(test), route)
      : null;
  });
  const commands = createMemo(() =>
    buildCommands({
      data: report.data,
      nav: props.nav,
      test: currentTest(),
      route: props.nav.route(),
      frame: currentFrame(),
    })
  );
  return (
    <CommandRegistryProvider enableDefaultShortcuts={false}>
      <RegisteredPalette nav={props.nav} commands={commands} />
    </CommandRegistryProvider>
  );
}
