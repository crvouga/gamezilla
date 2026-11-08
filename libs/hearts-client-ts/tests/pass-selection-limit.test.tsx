/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { fireEvent } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

// regression: hearts-fourth-pass-card-silent
test('three selected clubs explain how to revise when the fourth club is pressed', () => {
  const sent: string[] = [];
  const view = renderBoard(() => (
    <HeartsBoard
      position={heartsRules.initial()}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={null}
      hand="2C3C4C5C6C7C8C9CTCJCQCKCAC"
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={(action) => sent.push(action)}
    />
  ));
  for (const card of ['AC', 'KC', 'QC', 'JC'])
    fireEvent.click(byTestId(`hearts-card-${card}`));
  const guidance = view.getByText(
    '3 of 3 chosen. Unselect a card to choose another.'
  );
  expect(guidance.getAttribute('aria-live')).toBe('polite');
  expect(sent).toEqual([]);
  expect(byTestId('hearts-card-JC').getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(byTestId('hearts-card-QC'));
  expect(
    view.queryByText('3 of 3 chosen. Unselect a card to choose another.')
  ).toBeNull();
  fireEvent.click(byTestId('hearts-card-JC'));
  fireEvent.click(byTestId('hearts-pass'));
  expect(sent).toEqual(['JCKCAC']);
});
