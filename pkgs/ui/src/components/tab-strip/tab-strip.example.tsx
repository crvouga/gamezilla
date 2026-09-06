/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import {
  DatabaseIcon,
  Gamepad2Icon,
  HouseIcon,
  ListChecksIcon,
  PaintbrushIcon,
  ScrollTextIcon,
  TerminalIcon,
} from '../icons';
import { Stack } from '../stack';
import { Text } from '../text';
import { TabStrip } from './tab-strip';
import type { TabStripItem } from './tab-strip-types';

export default function TabStripExample(): JSX.Element {
  return (
    <ExampleRoot>
      <Stack spacing={0}>
        <NestedChromeDemo />
        <ClosableOverflowDemo />
      </Stack>
    </ExampleRoot>
  );
}

function NestedChromeDemo(): JSX.Element {
  const [app, setApp] = createSignal('console');
  const [section, setSection] = createSignal('playground');
  const [view, setView] = createSignal('ui');
  return (
    <>
      <Text
        variant="caption"
        label="Nested chrome (folder tabs merge into the panel below)"
        sx={{ padding: 12, color: 'textSecondary' }}
      />
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
            { id: 'reports', label: 'Reports', icon: ListChecksIcon },
            { id: 'playground', label: 'Playground', icon: Gamepad2Icon },
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
        <Box sx={{ padding: 16, minHeight: 72 }}>
          <Text
            variant="body"
            label={`${app()} / ${section()} / ${view()}`}
            sx={{ color: 'textSecondary' }}
          />
        </Box>
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
      <Text
        variant="caption"
        label="Overflow + closable drafts (hover close on inactive)"
        sx={{ padding: 12, paddingTop: 20, color: 'textSecondary' }}
      />
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
        <Box sx={{ padding: 16, minHeight: 56 }}>
          <Text
            variant="caption"
            label={summary()}
            sx={{ color: 'textSecondary' }}
          />
        </Box>
      </DemoFrame>
    </>
  );
}

function DemoFrame(props: { readonly children: JSX.Element }): JSX.Element {
  return (
    <Box
      sx={{
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        borderRadius: 'md',
        overflow: 'hidden',
        background: 'background',
      }}
    >
      {props.children}
    </Box>
  );
}
