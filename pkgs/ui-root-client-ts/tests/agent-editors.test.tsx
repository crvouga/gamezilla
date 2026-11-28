/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { asLocalized } from '@pkgs/i18n-shared-ts/localized-string';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import { CodeEditor } from '@pkgs/ui-root-client-ts/code-editor';
import { MarkdownEditor } from '@pkgs/ui-root-client-ts/markdown-editor';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal } from 'solid-js';

test('an agent edits highlighted source and rich text through the document model', async () => {
  const agent = createAgent();
  const [source, setSource] = createSignal('');
  const [notes, setNotes] = createSignal('');
  const time = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const view = render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider fixedLayout={{ width: 800, height: 600 }}>
          <CodeEditor
            aria-label={asLocalized('Rules')}
            value={source()}
            onChangeText={setSource}
            tokenize={() => []}
          />
          <MarkdownEditor
            aria-label="Instructions"
            value={notes()}
            onChange={setNotes}
          />
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
  const result = await agent.act({
    steps: [
      { ref: 'Rules', action: 'setValue', args: ['score + 1'] },
      { ref: 'Instructions', action: 'setValue', args: ['## Next move'] },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(view.getByRole('textbox', { name: 'Rules' })).toHaveValue('score + 1');
  expect(
    view.getByRole('textbox', { name: 'Instructions' }).querySelector('h2')
      ?.textContent
  ).toBe('Next move');
  view.unmount();
});
