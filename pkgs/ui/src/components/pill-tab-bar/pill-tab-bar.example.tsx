import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { Stack } from '../stack';
import { Text } from '../text';
import { PillTabBar } from './pill-tab-bar';

export default function PillTabBarExample() {
  const [app, setApp] = useState('main');
  const [section, setSection] = useState('reports');

  return (
    <ExampleRoot>
      <Stack spacing={4}>
        <PillTabBar
          accessibilityLabel="Apps"
          items={[
            { id: 'main', label: 'Main' },
            { id: 'console', label: 'Console' },
          ]}
          selectedId={app}
          onSelect={setApp}
        />
        <Text variant="caption" label={`App: ${app}`} />

        <PillTabBar
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
      </Stack>
    </ExampleRoot>
  );
}
