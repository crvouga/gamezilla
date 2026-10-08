import { expect, test } from 'bun:test';
import { InspectionWorkspace } from '@pkgs/ui-root-client/inspection-workspace';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { fireEvent, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

function workspace(width: number) {
  return render(() => {
    const [selected, setSelected] = createSignal('primary');
    return (
      <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 480 }}>
        <InspectionWorkspace
          primaryLabel="Replay"
          toolsLabel="Inspect test"
          selected={selected()}
          onSelect={setSelected}
          primary={<p>Recorded frame</p>}
          tools={[
            {
              key: 'timeline',
              label: 'Timeline',
              content: <p>Recorded steps</p>,
            },
            { key: 'state', label: 'State', content: <p>Stored state</p> },
          ]}
        />
      </ThemeProvider>
    );
  });
}

test('all inspection panes are reachable on a narrow phone', () => {
  // regression: report-state-mobile
  const view = workspace(320);
  expect(view.getByRole('region', { name: 'Replay' }).textContent).toContain(
    'Recorded frame'
  );
  fireEvent.click(view.getByRole('radio', { name: 'State' }));
  expect(view.getByRole('region', { name: 'State' }).textContent).toContain(
    'Stored state'
  );
  expect(view.queryByRole('region', { name: 'Replay' })).toBeNull();
  fireEvent.click(view.getByRole('radio', { name: 'Timeline' }));
  expect(view.getByRole('region', { name: 'Timeline' }).textContent).toContain(
    'Recorded steps'
  );
  fireEvent.click(view.getByRole('radio', { name: 'Replay' }));
  expect(view.getByRole('region', { name: 'Replay' }).textContent).toContain(
    'Recorded frame'
  );
  view.unmount();
});

test('wide inspection keeps the primary surface while switching tools', () => {
  const view = workspace(1440);
  fireEvent.click(view.getByRole('radio', { name: 'State' }));
  expect(view.getByRole('region', { name: 'Replay' }).textContent).toContain(
    'Recorded frame'
  );
  expect(view.getByRole('region', { name: 'State' }).textContent).toContain(
    'Stored state'
  );
  expect(view.queryByRole('region', { name: 'Timeline' })).toBeNull();
  view.unmount();
});
