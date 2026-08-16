import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { TabStrip } from './tab-strip';

export default function TabStripExample() {
  const [app, setApp] = useState('main');
  const [section, setSection] = useState('reports');
  const [view, setView] = useState('ui');

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
          leading={
            <Text
              sx={{ color: 'text', fontSize: 12, fontWeight: '600' }}
              label="Alice"
            />
          }
          items={[
            { id: 'ui', label: 'UI' },
            { id: 'db', label: 'DB' },
            { id: 'logs', label: 'Logs' },
          ]}
          selectedId={view}
          onSelect={setView}
        />
        <Text variant="caption" label={`View: ${view}`} />
      </Stack>
    </ExampleRoot>
  );
}
