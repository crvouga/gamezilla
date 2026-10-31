import { expect, mock, test } from 'bun:test';
import { ScreenBreadcrumbTrail } from '@pkgs/ui-root-client-ts/screen-breadcrumb-trail';
import { screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { renderUi } from './render';

// regression: wide-breadcrumb-parent-navigation-handle
test.each(['trail', 'pills'] as const)(
  '%s exposes exactly the immediate parent as the shared navigation control',
  async (presentation) => {
    const root = mock();
    const parent = mock();
    const [nested, setNested] = createSignal(true);
    renderUi(
      () => (
        <ScreenBreadcrumbTrail
          presentation={presentation}
          breadcrumbs={
            nested()
              ? [
                  { name: 'Home', onClick: root },
                  { name: 'Settings', onClick: parent },
                  { name: 'Appearance' },
                ]
              : [{ name: 'Home' }]
          }
        />
      ),
      { width: 1180, height: 820 }
    );
    const back = screen.getByTestId('nav-back');
    expect(back).toBe(screen.getByRole('link', { name: 'Settings' }));
    expect(screen.getAllByTestId('nav-back')).toHaveLength(1);
    await userEvent.setup().click(back);
    expect(parent).toHaveBeenCalledTimes(1);
    expect(root).not.toHaveBeenCalled();
    setNested(false);
    expect(screen.queryByTestId('nav-back')).toBeNull();
  }
);
