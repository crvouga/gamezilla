/** @jsxImportSource solid-js */
/** The account menu's Connectivity row as a listener hears it. */

import { describe, expect, test } from 'bun:test';
import { connectivityMenuAction } from '@libs/app-client/app-header-global-menu';
import { auditTree, formatFailure } from '@pkgs/a11y-shared/audit';
import { labelInName } from '@pkgs/a11y-shared/name-rules';
import { buildOverflowMenuContent } from '@pkgs/ui-client/overflow-menu-button';
import { FloatingMenu } from '@pkgs/ui-client/floating-menu';
import { screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

const ANCHOR = { x: 300, y: 20, width: 40, height: 40 };

describe('account menu connectivity row', () => {
  // regression: a11y-menu-label-not-in-name
  test('says its visible label: "Connectivity Online", not just "Online"', () => {
    const row = connectivityMenuAction({
      label: 'Connectivity',
      status: 'online',
      statusLabel: 'Online',
      onClick: () => undefined,
    });
    renderChrome(() => (
      <FloatingMenu
        open
        onClose={() => undefined}
        anchor={ANCHOR}
        label="Account menu"
        content={buildOverflowMenuContent([row], () => undefined)}
      />
    ));
    expect(auditTree(document.body, [labelInName]).map(formatFailure)).toEqual(
      []
    );
    expect(
      screen.getByRole('menuitem', { name: 'Connectivity Online' })
    ).toBeTruthy();
  });
});
