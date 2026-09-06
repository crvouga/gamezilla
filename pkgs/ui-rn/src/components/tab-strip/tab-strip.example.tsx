import type { ReactNode } from 'react';
import { useState } from 'react';
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

export default function TabStripExample() {
  return (
    <ExampleRoot>
      <Stack spacing={0}>
        <NestedChromeDemo />
        <ClosableOverflowDemo />
      </Stack>
    </ExampleRoot>
  );
}

function NestedChromeDemo() {
  const [app, setApp] = useState('console');
  const [section, setSection] = useState('playground');
  const [view, setView] = useState('ui');
  return (
    <>
      <Text
        variant="caption"
        label="Nested chrome (folder tabs merge into the panel below)"
        sx={{ padding: 3, color: 'textSecondary' }}
      />
      <DemoFrame>
        <TabStrip
          accessibilityLabel="Apps"
          items={[
            { id: 'main', label: 'Main', icon: HouseIcon },
            { id: 'console', label: 'Console', icon: TerminalIcon },
          ]}
          selectedId={app}
          onSelect={setApp}
        />
        <TabStrip
          accessibilityLabel="Console sections"
          items={[
            { id: 'reports', label: 'Reports', icon: ListChecksIcon },
            { id: 'playground', label: 'Playground', icon: Gamepad2Icon },
          ]}
          selectedId={section}
          onSelect={setSection}
        />
        <TabStrip
          accessibilityLabel="Panel views"
          items={[
            { id: 'ui', label: 'UI', icon: PaintbrushIcon },
            { id: 'db', label: 'DB', icon: DatabaseIcon },
            { id: 'logs', label: 'Logs', icon: ScrollTextIcon },
          ]}
          selectedId={view}
          onSelect={setView}
        />
        <Box sx={{ padding: 4, minHeight: 72 }}>
          <Text
            variant="body"
            label={`${app} / ${section} / ${view}`}
            sx={{ color: 'textSecondary' }}
          />
        </Box>
      </DemoFrame>
    </>
  );
}

function ClosableOverflowDemo() {
  const [tables, setTables] = useState('accounts');
  const [drafts, setDrafts] = useState([
    { id: 'a', label: 'sync_engine_mutations_applied' },
    { id: 'b', label: 'Draft' },
    { id: 'c', label: 'spaces_members' },
  ]);
  const [draftId, setDraftId] = useState('a');
  return (
    <>
      <Text
        variant="caption"
        label="Overflow + closable drafts (hover close on inactive)"
        sx={{ padding: 3, paddingTop: 5, color: 'textSecondary' }}
      />
      <DemoFrame>
        <TabStrip
          accessibilityLabel="Tables"
          items={[
            { id: 'accounts', label: 'accounts' },
            {
              id: 'sync_engine_write_rejections',
              label: 'sync_engine_write_rejections',
            },
            { id: 'spaces', label: 'spaces' },
            { id: 'profiles', label: 'profiles' },
          ]}
          selectedId={tables}
          onSelect={setTables}
        />
        <TabStrip
          accessibilityLabel="Closable drafts"
          items={drafts.map((d) => ({
            ...d,
            onClose: () => {
              const remaining = drafts.filter((x) => x.id !== d.id);
              setDrafts(remaining);
              setDraftId((cur) =>
                cur === d.id ? (remaining[0]?.id ?? '') : cur
              );
            },
          }))}
          selectedId={draftId || null}
          onSelect={setDraftId}
          onAdd={() => {
            const id = `d${drafts.length + 1}`;
            setDrafts((prev) => [
              ...prev,
              { id, label: `Draft ${prev.length + 1}` },
            ]);
            setDraftId(id);
          }}
        />
        <Box sx={{ padding: 4, minHeight: 56 }}>
          <Text
            variant="caption"
            label={
              draftId
                ? `Table: ${tables} · Draft: ${draftId}`
                : `Table: ${tables} · No drafts`
            }
            sx={{ color: 'textSecondary' }}
          />
        </Box>
      </DemoFrame>
    </>
  );
}

function DemoFrame(props: { readonly children: ReactNode }) {
  return (
    <Box
      sx={{
        borderWidth: 1,
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
