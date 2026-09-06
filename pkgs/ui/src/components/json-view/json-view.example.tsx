/** @jsxImportSource solid-js */
/**
 * `JsonView` takes an injected `copy` sink; the explorer records the last
 * copied text in local state instead of touching the clipboard.
 */
import { createSignal, type JSX, Show } from 'solid-js';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
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
    notifications: { push: true, email: false, digestFrequency: null },
    pinnedShortcuts: [],
  },
  spaces: [
    {
      id: 'spc_001',
      title: "Ada's space",
      live: true,
      memberCount: 3,
      members: [
        { deviceId: 'p_aaaa', role: 'host', joinedAt: '2026-05-03T10:00:00Z' },
        { deviceId: 'p_bbbb', role: 'guest', joinedAt: '2026-05-03T10:02:11Z' },
        { deviceId: 'p_cccc', role: 'guest', joinedAt: '2026-05-03T10:05:42Z' },
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

const CIRCULAR = buildCircularPayload();

function Section(props: { title: string; children: JSX.Element }): JSX.Element {
  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="label" label={props.title} />
      {props.children}
    </Box>
  );
}

export default function JsonViewExample(): JSX.Element {
  const [lastCopied, setLastCopied] = createSignal<string | null>(null);
  const copy = (text: string): Promise<void> => {
    setLastCopied(text);
    return Promise.resolve();
  };
  return (
    <ExampleRoot>
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label="Inspect any JS value as a collapsible JSON tree. Type-aware coloring; per-row and toolbar copy."
      />

      <Section title="Object payload (depth 1, default)">
        <JsonView label="payload" value={SAMPLE_PAYLOAD} copy={copy} />
      </Section>

      <Section title="Object payload, fully expanded by default">
        <JsonView
          label="payload (depth 99)"
          value={SAMPLE_PAYLOAD}
          initialExpandDepth={99}
          copy={copy}
        />
      </Section>

      <Section title="Array root">
        <JsonView value={ARRAY_PAYLOAD} initialExpandDepth={2} copy={copy} />
      </Section>

      <Section title="Primitive root (no toolbar)">
        <JsonView value={PRIMITIVE_PAYLOAD} hideToolbar hideRowCopy />
      </Section>

      <Section title="Circular reference + non-JSON values">
        <JsonView
          label="metrics-with-cycle"
          value={{ ...SAMPLE_PAYLOAD.metrics, circular: CIRCULAR }}
          initialExpandDepth={2}
          copy={copy}
        />
      </Section>

      <Section title="Bounded height (scrolls inside)">
        <JsonView
          value={SAMPLE_PAYLOAD}
          initialExpandDepth={3}
          maxHeight={220}
          copy={copy}
        />
      </Section>

      <Show when={lastCopied()}>
        {(text) => (
          <Text
            variant="caption"
            numberOfLines={2}
            sx={{ color: 'textSecondary' }}
            label={`Last copied: ${text()}`}
          />
        )}
      </Show>
    </ExampleRoot>
  );
}
