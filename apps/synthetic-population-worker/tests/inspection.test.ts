import { expect, test } from 'bun:test';
import { sanitizeDomSnapshot } from '@libs/synthetic-population-shared/inspection';

test('on-demand DOM inspection excludes sign-in links, tokens, private controls and hidden interactions', () => {
  // regression: synthetic-population-inspection-private-controls
  const dom = document.implementation.createHTMLDocument('Synthetic User');
  dom.documentElement.setAttribute('data-token', 'root-session-token');
  dom.body.innerHTML = `
    <script>root-session-token</script>
    <input value="https://app.example.test/sso-callback?email_link=cedar-secret-15-characters" data-testid="auth-email-link" aria-label="Sign-in link">
    <input type="hidden" value="root-session-token">
    <textarea>cedar-secret-15-characters</textarea>
    <div data-sensitive><button data-testid="private-copy">Private account data</button></div>
    <div hidden><button data-testid="hidden-action">Hidden</button></div>
    <div aria-hidden="true"><button data-testid="aria-hidden-action">Hidden</button></div>
    <button data-testid="join-space" aria-label="Join alice@example.com">Join</button>
    <p>Bearer root-session-token cedar-secret-15-characters</p>`;
  const result = sanitizeDomSnapshot(dom, [
    'root-session-token',
    'cedar-secret-15-characters',
  ]);
  const serialized = JSON.stringify(result);
  for (const secret of [
    'root-session-token',
    'cedar-secret-15-characters',
    'alice@example.com',
    'Private account data',
    // The link pasted into the sign-in form is an input value: never inspected.
    'email_link',
  ])
    expect(serialized).not.toContain(secret);
  expect(result.html).not.toContain('<script');
  expect(result.html).not.toContain('type="hidden"');
  expect(result.controls.map((item) => item.testId).sort()).toEqual([
    'auth-email-link',
    'join-space',
  ]);
  expect(
    result.controls.find((item) => item.testId === 'join-space')?.name
  ).toBe('Join [redacted email]');
  dom.body.querySelector('[data-testid="join-space"]')!.textContent =
    'Changed live instance';
  expect(sanitizeDomSnapshot(dom).html).toContain('Changed live instance');
});

test('selected application snapshots do not reconstruct a different instance', () => {
  const first = document.implementation.createHTMLDocument('First');
  const second = document.implementation.createHTMLDocument('Second');
  first.body.innerHTML = '<button data-testid="space-one">First space</button>';
  second.body.innerHTML =
    '<button data-testid="space-two">Second space</button>';
  expect(sanitizeDomSnapshot(first).controls[0]?.testId).toBe('space-one');
  expect(sanitizeDomSnapshot(second).controls[0]?.testId).toBe('space-two');
  first.body.innerHTML = '';
  expect(sanitizeDomSnapshot(second).html).toContain('Second space');
});
