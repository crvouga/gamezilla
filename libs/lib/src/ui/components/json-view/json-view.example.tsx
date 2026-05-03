import { useMemo } from 'react';

import { Box } from '../box';
import { Text } from '../text';
import { JsonView } from './json-view';

const SAMPLE_PAYLOAD = {
  user: {
    id: 'usr_4f2c-9b1a',
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
    isVerified: true,
    roles: ['host', 'admin'],
    createdAt: '2026-04-01T17:32:11.413Z',
  },
  preferences: {
    theme: 'dark',
    locale: 'en-US',
    notifications: {
      push: true,
      email: false,
      digestFrequency: null,
    },
    pinnedShortcuts: [],
  },
  spaces: [
    {
      id: 'spc_001',
      title: "Ada's space",
      live: true,
      memberCount: 3,
      members: [
        {
          principalId: 'p_aaaa',
          role: 'host',
          joinedAt: '2026-05-03T10:00:00Z',
        },
        {
          principalId: 'p_bbbb',
          role: 'guest',
          joinedAt: '2026-05-03T10:02:11Z',
        },
        {
          principalId: 'p_cccc',
          role: 'guest',
          joinedAt: '2026-05-03T10:05:42Z',
        },
      ],
    },
    {
      id: 'spc_002',
      title: 'Quick coffee',
      live: false,
      memberCount: 0,
      members: [],
      endedAt: '2026-05-02T14:11:09Z',
    },
  ],
  metrics: {
    sessionsToday: 12,
    bandwidthBytes: 9_876_543n,
    lastError: new Error('Network timeout'),
  },
};

const PRIMITIVE_PAYLOAD = 'just a string';

const ARRAY_PAYLOAD = [1, 2, 3, 'four', null, true, { nested: 'object' }];

function buildCircularPayload(): unknown {
  const root: Record<string, unknown> = { name: 'root', value: 1 };
  const child: Record<string, unknown> = { parent: root, depth: 1 };
  root['child'] = child;
  return root;
}

export default function JsonViewExample() {
  const circular = useMemo(() => buildCircularPayload(), []);
  return (
    <Box sx={{ p: 4, gap: 4 }}>
      <Text variant="heading" label="JsonView" />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Inspect any JS value as a collapsible JSON tree. Type-aware coloring; per-row and toolbar copy."
      />

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Object payload (depth 1, default)" />
        <JsonView label="payload" value={SAMPLE_PAYLOAD} />
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text
          variant="label"
          label="Object payload, fully expanded by default"
        />
        <JsonView
          label="payload (depth 99)"
          value={SAMPLE_PAYLOAD}
          initialExpandDepth={99}
        />
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Array root" />
        <JsonView value={ARRAY_PAYLOAD} initialExpandDepth={2} />
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Primitive root (no toolbar)" />
        <JsonView value={PRIMITIVE_PAYLOAD} hideToolbar hideRowCopy />
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Circular reference + non-JSON values" />
        <JsonView
          label="metrics-with-cycle"
          value={{
            ...SAMPLE_PAYLOAD.metrics,
            circular,
          }}
          initialExpandDepth={2}
        />
      </Box>

      <Box sx={{ gap: 1 }}>
        <Text variant="label" label="Bounded height (scrolls inside)" />
        <JsonView
          value={SAMPLE_PAYLOAD}
          initialExpandDepth={3}
          maxHeight={220}
        />
      </Box>
    </Box>
  );
}
