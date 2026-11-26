/** @jsxImportSource @solidjs/web */

import { expect, mock, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { SpaceShell } from '@pkgs/ui-root-client-ts/space-shell';
import { fireEvent, within } from '@solidjs/testing-library';
import fc from 'fast-check';
import { createSignal, flush } from 'solid-js';
import { renderUi } from './render';

// regression: space-bar-actions-hidden
test.each([
  { game: 'Quoridor', width: 320, role: 'host' },
  { game: 'Pong', width: 390, role: 'guest' },
  { game: 'Quoridor', width: 1440, role: 'host' },
] as const)(
  '$game at $width exposes every $role action with Minimize last',
  ({ game, width, role }) => {
    const minimize = mock();
    const leave = mock();
    const end = mock();
    const { container } = renderUi(
      () => (
        <SpaceShell
          spaceName="Friday game night with the whole family"
          title={game}
          role={role}
          onBack={mock()}
          onMembers={mock()}
          onInvite={mock()}
          onRename={role === 'host' ? mock() : undefined}
          onLeave={leave}
          onEnd={role === 'host' ? end : undefined}
          onMinimize={minimize}
        >
          <p>{game}</p>
        </SpaceShell>
      ),
      { width }
    );
    const bar = within(container).getByRole('banner');
    const buttons = within(bar).getAllByRole('button');
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
      'Back to spaces',
      'People in this space',
      'Share',
      ...(role === 'host' ? ['Rename'] : []),
      'Leave space',
      ...(role === 'host' ? ['End space'] : []),
      'Minimize space',
    ]);
    fireEvent.click(
      within(bar).getByRole('button', { name: 'Minimize space' })
    );
    expect(minimize).toHaveBeenCalledTimes(1);
    expect(leave).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  }
);

test('permission changes update the bar while Minimize stays last', () => {
  const press = mock();
  const [grants, setGrants] = createSignal({
    rename: false,
    leave: false,
    end: false,
  });
  const role = 'guest' as const;
  const { container } = renderUi(() => (
    <SpaceShell
      spaceName="Game night"
      role={role}
      onBack={press}
      onMembers={press}
      onMinimize={press}
      onInvite={press}
      onRename={grants().rename ? press : undefined}
      onLeave={grants().leave ? press : undefined}
      onEnd={grants().end ? press : undefined}
    >
      <p>{'Stage'}</p>
    </SpaceShell>
  ));
  const bar = within(within(container).getByRole('banner'));
  assertProperty(
    'space bar permissions',
    fc.property(
      fc.record({
        rename: fc.boolean(),
        leave: fc.boolean(),
        end: fc.boolean(),
      }),
      (next) => {
        setGrants(next);
        flush();
        expect(bar.queryByRole('button', { name: 'Rename' }) !== null).toBe(
          next.rename
        );
        expect(
          bar.queryByRole('button', { name: 'Leave space' }) !== null
        ).toBe(next.leave);
        expect(bar.queryByRole('button', { name: 'End space' }) !== null).toBe(
          next.end
        );
        expect(bar.getAllByRole('button').at(-1)).toBe(
          bar.getByRole('button', { name: 'Minimize space' })
        );
      }
    )
  );
});
