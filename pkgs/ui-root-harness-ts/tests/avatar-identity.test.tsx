/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import {
  AVATAR_TONES,
  Avatar,
  avatarInitials,
  avatarTone,
  YOUR_AVATAR_TONE,
} from '@pkgs/ui-root-client-ts/avatar';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';
import {
  compositeOver,
  contrastRatio,
  parseColor,
} from '@pkgs/ui-root-shared-ts/contrast';
import { parseCssColor, rgbaToRgb8 } from '@pkgs/ui-root-shared-ts/css-color';
import { cssOf, mustQuery, renderUi } from './render';

const TEXT = 4.5;
const NON_TEXT = 3;

/** An opaque ring against the surface under it. */
function ringContrast(
  scheme: 'light' | 'dark',
  ring: ColorTokenName,
  under: ColorTokenName
): number {
  const colors = COLOR_PALETTE[scheme];
  const front = parseColor(colors[ring]);
  const back = parseColor(colors[under]);
  if (front === null || back === null) {
    throw new Error(`unparseable ${scheme} ${ring} on ${under}`);
  }
  return contrastRatio(front, back);
}

/** Ink on a (possibly translucent) plate laid on the surface under it. */
function inkContrast(
  scheme: 'light' | 'dark',
  ink: ColorTokenName,
  plate: ColorTokenName,
  under: ColorTokenName
): number {
  const colors = COLOR_PALETTE[scheme];
  const base = parseCssColor(colors[under]);
  const back = parseCssColor(colors[plate]);
  const front = parseColor(colors[ink]);
  if (base === null || back === null || front === null) {
    throw new Error(`unparseable ${scheme} ${ink} on ${plate}`);
  }
  return contrastRatio(front, rgbaToRgb8(compositeOver(back, base)));
}

describe('avatarInitials', () => {
  test.each([
    ['jordan', 'J'],
    ['jordan_plays', 'JP'],
    ['@jordan_plays', 'JP'],
    ['Ada Lovelace', 'AL'],
    ['robin_42', 'R'],
    ['a_really_long_username', 'AR'],
    ['  morgan  ', 'M'],
    ['42', '4'],
    ['', ''],
    ['élodie-roy', 'ÉR'],
  ])('%p → %p', (name, initials) => {
    expect(avatarInitials(name)).toBe(initials);
  });
});

describe('avatar tones', () => {
  test('the same key always gives the same tone', () => {
    const key = '9f1c2a4e-0000-4000-8000-000000000002';
    expect(avatarTone(key)).toBe(avatarTone(key));
  });

  test('near-identical names spread across every tone', () => {
    const names = Array.from({ length: 40 }, (_, i) => `jordan_${i}`);
    const used = new Set(names.map((name) => avatarTone(name).plate));
    expect(used.size).toBe(AVATAR_TONES.length);
  });

  test('your own indigo plate is never another person’s tone', () => {
    expect(AVATAR_TONES.map((tone) => tone.plate)).not.toContain('tintSubtle');
  });

  for (const scheme of ['light', 'dark'] as const) {
    for (const under of ['background', 'surface'] as const) {
      test(`${scheme}: every tone's initials hold AA on ${under}`, () => {
        const low = AVATAR_TONES.flatMap((tone) => {
          const ratio = inkContrast(scheme, tone.ink, tone.plate, under);
          return ratio >= TEXT
            ? []
            : [`${tone.ink} on ${tone.plate}: ${ratio.toFixed(2)}`];
        });
        expect(low).toEqual([]);
      });

      test(`${scheme}: every initials ring holds 3:1 on ${under}`, () => {
        const low = [...AVATAR_TONES, YOUR_AVATAR_TONE].flatMap((tone) => {
          const ratio = ringContrast(scheme, tone.ring, under);
          return ratio >= NON_TEXT
            ? []
            : [`${tone.ring} ring on ${under}: ${ratio.toFixed(2)}`];
        });
        expect(low).toEqual([]);
      });
    }
  }

  test('your own initials keep their AA ink', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(
        inkContrast(
          scheme,
          YOUR_AVATAR_TONE.ink,
          YOUR_AVATAR_TONE.plate,
          'surface'
        )
      ).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

describe('Avatar initials ring', () => {
  test('an initials face wears its tone ring, not the hairline', () => {
    const tone = avatarTone('robin');
    renderUi(() => (
      <>
        <Avatar
          initials="R"
          tintKey="robin"
          dataSet={{ component: 'Tinted' }}
        />
        <Avatar initials="R" dataSet={{ component: 'Plain' }} />
        <Avatar initials="ME" you dataSet={{ component: 'You' }} />
      </>
    ));
    expect(mustQuery('[data-component="Tinted"]')).toHaveAttribute(
      'data-ring',
      tone.ring
    );
    expect(mustQuery('[data-component="Plain"]')).toHaveAttribute(
      'data-ring',
      'outline'
    );
    expect(mustQuery('[data-component="You"]')).toHaveAttribute(
      'data-ring',
      'tint'
    );
  });

  test('pictures, placeholders and ringless faces keep no tone ring', () => {
    renderUi(() => (
      <>
        <Avatar dataSet={{ component: 'Placeholder' }} />
        <Avatar
          uri="https://example.test/face.png"
          initials="R"
          dataSet={{ component: 'Picture' }}
        />
        <Avatar initials="R" ring={false} dataSet={{ component: 'Bare' }} />
      </>
    ));
    for (const id of ['Placeholder', 'Picture']) {
      expect(mustQuery(`[data-component="${id}"]`)).not.toHaveAttribute(
        'data-ring'
      );
    }
    expect(mustQuery('[data-component="Bare"]').className).not.toContain(
      'border'
    );
  });
});

describe('Avatar tintKey', () => {
  test('tints initials with the key’s tone plate and ink', () => {
    const tone = avatarTone('robin');
    renderUi(() => (
      <Avatar initials="R" tintKey="robin" dataSet={{ component: 'Tinted' }} />
    ));
    const face = mustQuery('[data-component="Tinted"]');
    expect(face).toHaveAttribute('data-tone', tone.plate);
    expect(cssOf(face)).toContain('background-color:var(--ui-color-');
  });

  test('leaves pictures, placeholders and your own face untinted', () => {
    renderUi(() => (
      <>
        <Avatar tintKey="robin" dataSet={{ component: 'Placeholder' }} />
        <Avatar
          you
          initials="ME"
          tintKey="robin"
          dataSet={{ component: 'You' }}
        />
        <Avatar
          uri="https://example.test/face.png"
          initials="R"
          tintKey="robin"
          dataSet={{ component: 'Picture' }}
        />
      </>
    ));
    for (const id of ['Placeholder', 'You', 'Picture']) {
      expect(mustQuery(`[data-component="${id}"]`)).not.toHaveAttribute(
        'data-tone'
      );
    }
  });
});
