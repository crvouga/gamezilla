import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { Table } from '@pkgs/ui-root-client-ts/table';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createAgent } from '@ui-sdk/solid/agent';

test('an agent opens the named table row', async () => {
  const opened: string[] = [];
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 960, height: 640 }}
    >
      <Table
        rows={['Ada', 'Grace']}
        columns={[{ key: 'player', header: 'Player', render: (name) => name }]}
        rowKey={(name) => name}
        rowLabel={(name) => `View ${name}`}
        onRowPress={(name) => opened.push(name)}
      />
    </ThemeProvider>
  ));
  const result = await createAgent().act({
    steps: [{ ref: 'View Grace', action: 'activateRow' }],
  });
  expect(result.error?.message).toBeUndefined();
  expect(opened).toEqual(['Grace']);
});
