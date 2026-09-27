import type { HtmlReportTest } from '@pkgs/sim';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';
import {
  frameHasUi,
  neighborFailure,
  selectedFrame,
  testFrames,
} from '../lib/frames';
import { showAside, showPress, viewMode, zoomMode } from '../lib/hash';
import type { ReportData } from '../types';

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
      run: () => nav.navigate({ view: 'list', params: {} }),
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
  return data.tests.map((test) => ({
    id: `test:${test.report.meta.testId}`,
    label: `Open ${test.report.meta.title}`,
    hint: test.report.meta.status,
    keywords: `${test.report.meta.title} ${test.report.meta.testId} ${test.report.meta.sourceFile ?? ''}`,
    run: () =>
      nav.navigate({
        view: 'test',
        testId: test.report.meta.testId,
        params: {},
      }),
  }));
}

function buildCommands(ctx: CommandContext): Command[] {
  const commands = baseCommands(ctx.nav);
  if (ctx.test && ctx.route.view === 'test') {
    commands.push(...timelineCommands(ctx.nav, ctx.test));
    if (frameHasUi(ctx.frame)) commands.push(...uiCommands(ctx.nav, ctx.route));
  }
  commands.push(...testCommands(ctx.nav, ctx.data));
  return commands;
}

function CommandList(props: {
  commands: Command[];
  activeIndex: () => number;
  setActiveIndex: (value: number) => void;
  runActive: () => void;
}) {
  return (
    <div class="sr-palette-list" role="listbox" aria-label="Commands">
      <Show
        when={props.commands.length > 0}
        fallback={<div class="sr-palette-empty">No matching commands</div>}
      >
        <For each={props.commands}>
          {(command, index) => (
            <button
              type="button"
              class="sr-command"
              classList={{ active: index() === props.activeIndex() }}
              role="option"
              aria-selected={index() === props.activeIndex()}
              onMouseEnter={() => props.setActiveIndex(index())}
              onClick={props.runActive}
            >
              <span>{command.label}</span>
              <kbd>{command.hint}</kbd>
            </button>
          )}
        </For>
      </Show>
    </div>
  );
}

function PaletteDialog(props: { nav: ReportNav; commands: () => Command[] }) {
  let inputEl: HTMLInputElement | undefined;
  onMount(() => inputEl?.focus());
  const [query, setQuery] = createSignal('');
  const [activeIndex, setActiveIndex] = createSignal(0);
  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase();
    return needle
      ? props
          .commands()
          .filter((command) =>
            `${command.label} ${command.hint} ${command.keywords}`
              .toLowerCase()
              .includes(needle)
          )
      : props.commands();
  });
  createEffect(() => {
    filtered();
    setActiveIndex(0);
  });
  const runActive = () => {
    const command = filtered()[activeIndex()];
    if (!command) return;
    props.nav.closePalette();
    setQuery('');
    command.run();
  };

  return (
    <section
      class="sr-palette"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sr-palette-title"
      onKeyDown={(e) => {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveIndex((index) => Math.min(index + 1, filtered().length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveIndex((index) => Math.max(index - 1, 0));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          runActive();
        }
      }}
    >
      <div class="sr-palette-head">
        <div>
          <h2 id="sr-palette-title">Command palette</h2>
          <p>Navigate the report without reaching for the mouse.</p>
        </div>
        <kbd>Esc</kbd>
      </div>
      <input
        ref={inputEl}
        class="sr-palette-input"
        type="search"
        autofocus
        value={query()}
        placeholder="Search commands or tests…"
        aria-label="Search commands"
        onInput={(e) => setQuery(e.currentTarget.value)}
      />
      <CommandList
        commands={filtered()}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        runActive={runActive}
      />
      <div class="sr-palette-footer">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd> move
        </span>
        <span>
          <kbd>Enter</kbd> run
        </span>
        <span>
          <kbd>⌘ K</kbd> toggle
        </span>
      </div>
    </section>
  );
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
    <Show when={props.nav.showPalette()}>
      <div
        class="sr-palette-backdrop"
        role="presentation"
        onClick={(e) => {
          if (e.target === e.currentTarget) props.nav.closePalette();
        }}
      >
        <PaletteDialog nav={props.nav} commands={commands} />
      </div>
    </Show>
  );
}
