import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { TabStrip } from './tab-strip';

export default function TabStripExample() {
  const [app, setApp] = useState('main');
  const [section, setSection] = useState('reports');
  const [view, setView] = useState('ui');
  const [tables, setTables] = useState('accounts');
  const [drafts, setDrafts] = useState([
    { id: 'a', label: 'sync_engine_mutations_applied' },
    { id: 'b', label: 'Draft' },
  ]);
  const [draftId, setDraftId] = useState('a');

  return (
    <ExampleRoot>
      <Stack spacing={4}>
        <TabStrip
          accessibilityLabel="Apps"
          items={[
            { id: 'main', label: 'Main' },
            { id: 'console', label: 'Console' },
          ]}
          selectedId={app}
          onSelect={setApp}
        />
        <Text variant="caption" label={`App: ${app}`} />

        <TabStrip
          accessibilityLabel="Console sections"
          items={[
            { id: 'reports', label: 'Reports' },
            { id: 'playground', label: 'Playground' },
            { id: 'session', label: 'Session' },
          ]}
          selectedId={section}
          onSelect={setSection}
        />
        <Text variant="caption" label={`Section: ${section}`} />

        <TabStrip
          accessibilityLabel="Panel views"
          items={[
            { id: 'ui', label: 'UI' },
            { id: 'db', label: 'DB' },
            { id: 'logs', label: 'Logs' },
          ]}
          selectedId={view}
          onSelect={setView}
        />
        <Text variant="caption" label={`View: ${view}`} />

        <TabStrip
          accessibilityLabel="Tables"
          items={[
            { id: 'accounts', label: 'accounts' },
            {
              id: 'sync_engine_write_rejections',
              label: 'sync_engine_write_rejections',
            },
            { id: 'spaces', label: 'spaces' },
          ]}
          selectedId={tables}
          onSelect={setTables}
        />
        <Text variant="caption" label={`Table: ${tables}`} />

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
        <Text
          variant="caption"
          label={draftId ? `Draft: ${draftId}` : 'No drafts'}
        />
      </Stack>
    </ExampleRoot>
  );
}
