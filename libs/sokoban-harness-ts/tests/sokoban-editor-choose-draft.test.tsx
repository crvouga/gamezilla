import { expect, mock, test } from 'bun:test';
import { SokobanEditor } from '@libs/sokoban-client-ts/sokoban-editor';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

// regression: sokoban-editor-choose-draft
test('an unreadable board opens the saved draft chooser without editing the draft', () => {
  const choose = mock();
  const change = mock();
  const time = createHarnessClock();
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider>
        <SokobanEditor
          definition="not a board"
          disabled={false}
          onChooseCopy={choose}
          onChange={change}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  fireEvent.click(view.getByRole('button', { name: 'Choose saved draft' }));
  expect(choose).toHaveBeenCalledTimes(1);
  expect(change).not.toHaveBeenCalled();
});
