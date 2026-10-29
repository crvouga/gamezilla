/** @jsxImportSource solid-js */
/**
 * The state blocks and the screen's sticky primary action: an empty state
 * invites, an error says what to do and offers the retry, a skeleton takes
 * the shape of what is loading, and a phone form puts its primary action
 * first, full width.
 */

import { describe, expect, mock, test } from 'bun:test';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { FormActionsFooter } from '@pkgs/ui-root-client-ts/form-actions-footer';
import {
  SkeletonContent,
  type SkeletonContentVariant,
} from '@pkgs/ui-root-client-ts/skeleton';
import { fireEvent, screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

const COMPACT = { width: 390, height: 800 };
const WIDE = { width: 1280, height: 900 };

describe('EmptyState', () => {
  test('always says what to do next, and the action is the primary', () => {
    const onClick = mock();
    renderUi(() => (
      <EmptyState
        variant="compact"
        title="No friends yet"
        body="Search for someone by username to add them."
        action={{ label: 'Find people', onClick }}
      />
    ));
    expect(
      screen.getByText('Search for someone by username to add them.')
    ).toHaveClass('textCaption');
    const action = screen.getByRole('button', { name: 'Find people' });
    expect(action).toHaveAttribute('data-intent', 'primary');
    fireEvent.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorState', () => {
  test('renders what broke, what to do, and a retry with the default label', () => {
    const retry = mock();
    renderUi(() => (
      <ErrorState
        title="Couldn't load your spaces"
        body="Check your connection and try again."
        retry={{ onClick: retry }}
      />
    ));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load your spaces");
    expect(alert).toHaveTextContent('Check your connection and try again.');
    const button = screen.getByRole('button', { name: 'Retry' });
    expect(button).toHaveAttribute('data-intent', 'primary');
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  test('every variant shows the guidance line', () => {
    for (const variant of ['fill', 'compact', 'band'] as const) {
      const view = renderUi(() => (
        <ErrorState
          variant={variant}
          title="Friend request not sent"
          body="Try again later."
        />
      ));
      expect(screen.getByRole('alert')).toHaveTextContent('Try again later.');
      view.unmount();
    }
  });
});

describe('SkeletonContent', () => {
  const variants: readonly SkeletonContentVariant[] = [
    'rows',
    'avatarText',
    'tiles',
    'board',
  ];

  test('each shape is one polite loading status with hidden placeholders', () => {
    for (const variant of variants) {
      const view = renderUi(() => <SkeletonContent variant={variant} />);
      const status = screen.getByRole('status', { name: 'Loading' });
      expect(status).toHaveAttribute('data-variant', variant);
      expect(status).toHaveAttribute('aria-busy', 'true');
      expect(
        status.querySelector('[aria-hidden="true"] .skeleton')
      ).not.toBeNull();
      view.unmount();
    }
  });

  test('rows, people and tiles draw `count` items; people lead with an avatar', () => {
    const view = renderUi(() => (
      <SkeletonContent variant="avatarText" count={5} label="Loading friends" />
    ));
    const status = screen.getByRole('status', { name: 'Loading friends' });
    expect(status.querySelectorAll('.panelItem')).toHaveLength(5);
    expect(
      status.querySelectorAll('[data-shape="circle"]').length
    ).toBeGreaterThanOrEqual(5);
    view.unmount();
    renderUi(() => <SkeletonContent variant="tiles" count={6} />);
    expect(mustQuery('[data-slot="tiles"]').children).toHaveLength(6);
  });

  test('the board is a square between two player bars', () => {
    renderUi(() => <SkeletonContent variant="board" />);
    const board = mustQuery('[data-slot="board"]');
    expect(board.querySelector('.aspect-square')).not.toBeNull();
    expect(board.querySelectorAll('[data-shape="circle"]')).toHaveLength(2);
  });
});

describe('FormActionsFooter', () => {
  const footer = () => (
    <FormActionsFooter
      cancel={{ label: 'Cancel', onClick: () => undefined }}
      submit={{ label: 'Save', operation: () => Promise.resolve() }}
    />
  );

  test('on phones the primary action comes first, full width, Cancel under it', () => {
    renderUi(footer, COMPACT);
    const root = mustQuery('[data-component="FormActionsFooter"]');
    expect(root).toHaveAttribute('data-layout', 'stacked');
    expect(root.className).toMatch(/\bflex-col\b/);
    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveAccessibleName('Save');
    expect(first?.className).toMatch(/\bw-full\b/);
    expect(second).toHaveAccessibleName('Cancel');
    expect(second?.className).toMatch(/\bw-full\b/);
  });

  test('on wide layouts both share one row, the primary on the right', () => {
    renderUi(footer, WIDE);
    const root = mustQuery('[data-component="FormActionsFooter"]');
    expect(root).toHaveAttribute('data-layout', 'row');
    expect(root.className).toMatch(/\bflex-row-reverse\b/);
    const [first] = screen.getAllByRole('button');
    expect(first).toHaveAccessibleName('Save');
    expect(first?.className).toMatch(/\bflex-1\b/);
  });
});
