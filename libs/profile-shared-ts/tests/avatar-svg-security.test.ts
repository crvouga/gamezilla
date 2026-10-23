import { expect, test } from 'bun:test';
import { profileAvatarSvg } from '@libs/profile-shared-ts/profile-dicebear';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const PAYLOAD =
  '50" /><image href="x" onerror="alert(1)" /><text font-size="50';

function assertEscaped(option: string, value: string): void {
  const svg = profileAvatarSvg(
    { style: 'initials', seed: 'Alice', options: { [option]: value } },
    96
  );
  const document = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(document.querySelector('parsererror')).toBeNull();
  expect(document.querySelector('image, [onerror]')).toBeNull();
  expect(document.documentElement.tagName).toBe('svg');
}

// regression: avatar-svg-numeric-option-injection
test('numeric avatar options cannot insert SVG elements or event handlers', () => {
  for (const option of ['rotate', 'fontSize', 'fontWeight']) {
    assertEscaped(option, PAYLOAD);
  }
});

test('avatar option strings remain escaped for arbitrary attribute values', () => {
  assertProperty(
    'numeric avatar options cannot escape their attributes',
    fc.property(
      fc.constantFrom('rotate', 'fontSize', 'fontWeight'),
      fc.string({ maxLength: 40 }),
      (option, prefix) => assertEscaped(option, prefix + PAYLOAD)
    )
  );
});
