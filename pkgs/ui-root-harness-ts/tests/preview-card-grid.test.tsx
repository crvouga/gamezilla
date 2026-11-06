/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import {
  PreviewCard,
  PreviewCardGrid,
} from '@pkgs/ui-root-client-ts/preview-card-grid';
import { PreviewThumbnail } from '@pkgs/ui-root-client-ts/preview-thumbnail';
import { fireEvent, screen } from '@solidjs/testing-library';
import PreviewCardGridExample from '../../ui-root-client-ts/src/preview-card-grid/preview-card-grid.example';
import { renderUi } from './render';

test('a section of cards: a named list, each card one button with its picture hidden', () => {
  renderUi(() => <PreviewCardGridExample />, { width: 390, height: 844 });
  const section = screen.getByRole('region', { name: 'Continue playing' });
  const list = section.querySelector('ul');
  expect(list?.children).toHaveLength(3);
  const card = screen.getByTestId('example-card-b');
  expect(card.tagName).toBe('BUTTON');
  expect(card.getAttribute('data-component')).toBe('PreviewCard');
  const picture = card.querySelector('[data-component="PreviewThumbnail"]');
  expect(picture?.getAttribute('aria-hidden')).toBe('true');
  expect(picture?.getAttribute('data-size')).toBe('fill');
  // The whole title, never clamped, then the caption and the meta line.
  expect(card.textContent).toContain(
    'Around the pillar and back to the door without a step wasted'
  );
  expect(card.querySelector('.textRowTitle')?.className).not.toMatch(
    /line-clamp|truncate/
  );
  expect(card.textContent).toContain('Weekend pack · Solved 2 of 5');
  expect(section.textContent).toContain('Each attempt keeps your progress.');
  expect(auditTree(document.body).map(formatFailure)).toEqual([]);
});

test('pressing a card runs its action; a disabled card does not', () => {
  const opened: string[] = [];
  renderUi(() => (
    <PreviewCardGrid title="Puzzles">
      <PreviewCard
        picture={<PreviewThumbnail size="fill">{'A'}</PreviewThumbnail>}
        title="Open me"
        onClick={() => opened.push('open')}
        dataSet={{ testid: 'open' }}
      />
      <PreviewCard
        picture={<PreviewThumbnail size="fill">{'B'}</PreviewThumbnail>}
        title="Not now"
        disabled
        onClick={() => opened.push('disabled')}
        dataSet={{ testid: 'disabled' }}
      />
    </PreviewCardGrid>
  ));
  fireEvent.click(screen.getByTestId('open'));
  fireEvent.click(screen.getByTestId('disabled'));
  expect(opened).toEqual(['open']);
});
