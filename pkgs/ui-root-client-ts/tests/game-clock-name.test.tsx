import { expect, test } from 'bun:test';
import { GameClock } from '@pkgs/ui-root-client-ts/game-clock';
import { render, screen } from '@solidjs/testing-library';

// regression: game-clock-name-on-generic-span
test('a clock names its timer, and no generic element carries aria-label', () => {
  const mounted = render(() => (
    <GameClock label="White" value="4:12" active ariaLabel="White, 4:12" />
  ));
  try {
    const timer = screen.getByRole('timer');
    expect(timer.getAttribute('aria-label')).toBe('White, 4:12');
    expect(timer.textContent).toContain('4:12');
    for (const named of mounted.container.querySelectorAll('[aria-label]'))
      expect(named.getAttribute('role')).not.toBeNull();
  } finally {
    mounted.unmount();
  }
});
