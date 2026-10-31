/** @jsxImportSource solid-js */

import { TabStrip } from '@pkgs/ui-devtools-client-ts/tab-strip';
import type { TabStripItem } from '@pkgs/ui-devtools-client-ts/tab-strip-types';
import {
  DatabaseIcon,
  FlaskConicalIcon,
  HouseIcon,
  MonitorPlayIcon,
  PaintbrushIcon,
  ScrollTextIcon,
  TerminalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../../ui-root-client-ts/storybook/fixtures/example-root';

export default function TabStripExample(): JSX.Element {
  return (
    <ExampleRoot>
      <div class="box flex-col gap-0">
        <NestedChromeDemo />
        <ClosableOverflowDemo />
      </div>
    </ExampleRoot>
  );
}

function NestedChromeDemo(): JSX.Element {
  const [app, setApp] = createSignal('console');
  const [section, setSection] = createSignal('harness');
  const [view, setView] = createSignal('ui');
  return (
    <>
      <p class="text textCaption p-3 text-text-secondary">
        {'Nested chrome (folder tabs merge into the panel below)'}
      </p>
      <DemoFrame>
        <TabStrip
          aria-label="Apps"
          items={[
            { id: 'main', label: 'Main', icon: HouseIcon },
            { id: 'console', label: 'Console', icon: TerminalIcon },
          ]}
          selectedId={app()}
          onSelect={setApp}
        />
        <TabStrip
          aria-label="Console sections"
          items={[
            { id: 'tests', label: 'Tests', icon: FlaskConicalIcon },
            { id: 'harness', label: 'Harness', icon: MonitorPlayIcon },
          ]}
          selectedId={section()}
          onSelect={setSection}
        />
        <TabStrip
          aria-label="Panel views"
          items={[
            { id: 'ui', label: 'UI', icon: PaintbrushIcon },
            { id: 'db', label: 'DB', icon: DatabaseIcon },
            { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
          ]}
          selectedId={view()}
          onSelect={setView}
        />
        <div class="box p-4 min-h-18">
          <p class="text text-text-secondary">{`${app()} / ${section()} / ${view()}`}</p>
        </div>
      </DemoFrame>
    </>
  );
}

type Draft = { id: string; label: string };

const TABLE_ITEMS: readonly TabStripItem[] = [
  { id: 'accounts', label: 'accounts' },
  { id: 'sync_engine_write_rejections', label: 'sync_engine_write_rejections' },
  { id: 'spaces', label: 'spaces' },
  { id: 'profiles', label: 'profiles' },
];

function ClosableOverflowDemo(): JSX.Element {
  const [tables, setTables] = createSignal('accounts');
  const [drafts, setDrafts] = createSignal<readonly Draft[]>([
    { id: 'a', label: 'sync_engine_mutations_applied' },
    { id: 'b', label: 'Draft' },
    { id: 'c', label: 'spaces_members' },
  ]);
  const [draftId, setDraftId] = createSignal('a');
  const closeDraft = (id: string): void => {
    const remaining = drafts().filter((x) => x.id !== id);
    setDrafts(remaining);
    if (draftId() === id) setDraftId(remaining[0]?.id ?? '');
  };
  const addDraft = (): void => {
    setDrafts((prev) => [
      ...prev,
      { id: `d${prev.length + 1}`, label: `Draft ${prev.length + 1}` },
    ]);
    setDraftId(`d${drafts().length}`);
  };
  const draftItems = (): TabStripItem[] =>
    drafts().map((d) => ({ ...d, onClose: () => closeDraft(d.id) }));
  const summary = (): string =>
    draftId() === ''
      ? `Table: ${tables()} · No drafts`
      : `Table: ${tables()} · Draft: ${draftId()}`;
  return (
    <>
      <p class="text textCaption p-3 pt-5 text-text-secondary">
        {'Overflow + closable drafts (hover close on inactive)'}
      </p>
      <DemoFrame>
        <TabStrip
          aria-label="Tables"
          items={TABLE_ITEMS}
          selectedId={tables()}
          onSelect={setTables}
        />
        <TabStrip
          aria-label="Closable drafts"
          items={draftItems()}
          selectedId={draftId() === '' ? null : draftId()}
          onSelect={setDraftId}
          onAdd={addDraft}
        />
        <div class="box p-4 min-h-14">
          <p class="text textCaption text-text-secondary">{summary()}</p>
        </div>
      </DemoFrame>
    </>
  );
}

function DemoFrame(props: { readonly children: JSX.Element }): JSX.Element {
  return (
    <div class="box border border-solid border-border rounded-control overflow-hidden bg-background">
      {props.children}
    </div>
  );
}
