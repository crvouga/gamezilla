/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { SpeakingAvatar } from '@pkgs/ui-client/speaking-avatar';
import { fireEvent, screen } from '@solidjs/testing-library';
import { createSignal, untrack } from 'solid-js';
import { renderUi } from './render';

// regression: avatar-loading-hides-observation
test('speech loading retains complete words in the same live region through context changes and mute', () => {
  const [text, setText] = createSignal(
    'That move would leave your knight on d2 hanging: it can be captured without a recapture.'
  );
  const [context, setContext] = createSignal('first');
  const [loading, setLoading] = createSignal(true);
  const enabled: boolean[] = [];
  renderUi(
    () => (
      <SpeakingAvatar
        message={text()}
        contextKey={context()}
        speaker={(args) => ({
          isLoading: loading,
          isSpeaking: () => {
            enabled.push(args().enabled);
            return false;
          },
        })}
      />
    ),
    { width: 320, height: 640 }
  );
  const region = screen.getByText(untrack(text));
  expect(region).toHaveAttribute('aria-live', 'polite');
  expect(region.getAttribute('style')).not.toContain('line-clamp');
  expect(region.style.overflow).not.toBe('hidden');
  setText('Checkmate! You found a valid finish.');
  setContext('second');
  setLoading(false);
  expect(screen.getByText(untrack(text))).toBe(region);
  fireEvent.click(screen.getByRole('button', { name: 'Mute coach' }));
  expect(enabled.at(-1)).toBe(false);
  expect(screen.getByText(untrack(text))).toBe(region);
});
