import { expect, mock, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { EditableBugReport } from '@pkgs/feedback-client-ts/bug-report-form.example';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { flush } from 'solid-js';

// regression: feedback-story-drops-typed-description
test('the feedback example retains each keystroke through submission', async () => {
  const describe = mock();
  const send = mock();
  const view = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <EditableBugReport
        description=""
        screenshots={[]}
        adding={0}
        phase="draft"
        notice={null}
        waiting={0}
        onDescribe={describe}
        onSend={send}
        onAddPicture={() => {}}
        onRemoveScreenshot={() => {}}
        onDiscard={() => {}}
        onClose={() => {}}
      />
    </ThemeProvider>
  ));
  const field = view.getByRole('textbox', {
    name: 'What happened?',
  }) as HTMLTextAreaElement;
  for (const letter of 'It froze') {
    field.value += letter;
    field.dispatchEvent(
      new InputEvent('input', { bubbles: true, data: letter })
    );
    await Promise.resolve();
    flush();
  }
  expect(field.value).toBe('It froze');
  expect(describe).toHaveBeenLastCalledWith('It froze');
  view.getByRole('button', { name: 'Send bug report' }).click();
  expect(send).toHaveBeenCalledTimes(1);
});
