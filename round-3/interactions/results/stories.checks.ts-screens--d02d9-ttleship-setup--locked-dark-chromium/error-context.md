# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--locked dark
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  24583 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-dark.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-dark.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 24583 pixels (ratio 0.08 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - captured a stable screenshot
  - 24583 pixels (ratio 0.08 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - generic [ref=e12]:
      - img [ref=e15]
      - generic [ref=e17]: Your fleet is locked in and can no longer change.
    - generic [ref=e18]:
      - button "Rotate down" [disabled] [ref=e19]:
        - paragraph [ref=e22]: Rotate down
      - button "Remove" [disabled] [ref=e23]:
        - paragraph [ref=e26]: Remove
    - button "Enlarge placement" [disabled] [ref=e28]:
      - paragraph [ref=e31]: Enlarge placement
    - group "Your waters" [ref=e32]:
      - generic [ref=e34]: A
      - generic [ref=e35]: B
      - generic [ref=e36]: C
      - generic [ref=e37]: D
      - generic [ref=e38]: E
      - generic [ref=e39]: F
      - generic [ref=e40]: G
      - generic [ref=e41]: H
      - generic [ref=e42]: I
      - generic [ref=e43]: J
      - generic [ref=e44]: "1"
      - 'button "A1: Carrier" [disabled] [ref=e45]':
        - generic: ■
      - 'button "B1: Carrier" [disabled] [ref=e46]':
        - generic: ■
      - 'button "C1: Carrier" [disabled] [ref=e47]':
        - generic: ■
      - 'button "D1: Carrier" [disabled] [ref=e48]':
        - generic: ■
      - 'button "E1: Carrier" [disabled] [ref=e49]':
        - generic: ■
      - 'button "F1: open water" [disabled] [ref=e50]'
      - 'button "G1: open water" [disabled] [ref=e51]'
      - 'button "H1: open water" [disabled] [ref=e52]'
      - 'button "I1: open water" [disabled] [ref=e53]'
      - 'button "J1: open water" [disabled] [ref=e54]'
      - generic [ref=e55]: "2"
      - 'button "A2: open water" [disabled] [ref=e56]'
      - 'button "B2: open water" [disabled] [ref=e57]'
      - 'button "C2: open water" [disabled] [ref=e58]'
      - 'button "D2: open water" [disabled] [ref=e59]'
      - 'button "E2: open water" [disabled] [ref=e60]'
      - 'button "F2: open water" [disabled] [ref=e61]'
      - 'button "G2: open water" [disabled] [ref=e62]'
      - 'button "H2: open water" [disabled] [ref=e63]'
      - 'button "I2: open water" [disabled] [ref=e64]'
      - 'button "J2: open water" [disabled] [ref=e65]'
      - generic [ref=e66]: "3"
      - 'button "A3: Battleship" [disabled] [ref=e67]':
        - generic: ■
      - 'button "B3: open water" [disabled] [ref=e68]'
      - 'button "C3: Cruiser" [disabled] [ref=e69]':
        - generic: ■
      - 'button "D3: open water" [disabled] [ref=e70]'
      - 'button "E3: Submarine" [disabled] [ref=e71]':
        - generic: ■
      - 'button "F3: open water" [disabled] [ref=e72]'
      - 'button "G3: Destroyer" [disabled] [ref=e73]':
        - generic: ■
      - 'button "H3: open water" [disabled] [ref=e74]'
      - 'button "I3: open water" [disabled] [ref=e75]'
      - 'button "J3: open water" [disabled] [ref=e76]'
      - generic [ref=e77]: "4"
      - 'button "A4: Battleship" [disabled] [ref=e78]':
        - generic: ■
      - 'button "B4: open water" [disabled] [ref=e79]'
      - 'button "C4: Cruiser" [disabled] [ref=e80]':
        - generic: ■
      - 'button "D4: open water" [disabled] [ref=e81]'
      - 'button "E4: Submarine" [disabled] [ref=e82]':
        - generic: ■
      - 'button "F4: open water" [disabled] [ref=e83]'
      - 'button "G4: Destroyer" [disabled] [ref=e84]':
        - generic: ■
      - 'button "H4: open water" [disabled] [ref=e85]'
      - 'button "I4: open water" [disabled] [ref=e86]'
      - 'button "J4: open water" [disabled] [ref=e87]'
      - generic [ref=e88]: "5"
      - 'button "A5: Battleship" [disabled] [ref=e89]':
        - generic: ■
      - 'button "B5: open water" [disabled] [ref=e90]'
      - 'button "C5: Cruiser" [disabled] [ref=e91]':
        - generic: ■
      - 'button "D5: open water" [disabled] [ref=e92]'
      - 'button "E5: Submarine" [disabled] [ref=e93]':
        - generic: ■
      - 'button "F5: open water" [disabled] [ref=e94]'
      - 'button "G5: open water" [disabled] [ref=e95]'
      - 'button "H5: open water" [disabled] [ref=e96]'
      - 'button "I5: open water" [disabled] [ref=e97]'
      - 'button "J5: open water" [disabled] [ref=e98]'
      - generic [ref=e99]: "6"
      - 'button "A6: Battleship" [disabled] [ref=e100]':
        - generic: ■
      - 'button "B6: open water" [disabled] [ref=e101]'
      - 'button "C6: open water" [disabled] [ref=e102]'
      - 'button "D6: open water" [disabled] [ref=e103]'
      - 'button "E6: open water" [disabled] [ref=e104]'
      - 'button "F6: open water" [disabled] [ref=e105]'
      - 'button "G6: open water" [disabled] [ref=e106]'
      - 'button "H6: open water" [disabled] [ref=e107]'
      - 'button "I6: open water" [disabled] [ref=e108]'
      - 'button "J6: open water" [disabled] [ref=e109]'
      - generic [ref=e110]: "7"
      - 'button "A7: open water" [disabled] [ref=e111]'
      - 'button "B7: open water" [disabled] [ref=e112]'
      - 'button "C7: open water" [disabled] [ref=e113]'
      - 'button "D7: open water" [disabled] [ref=e114]'
      - 'button "E7: open water" [disabled] [ref=e115]'
      - 'button "F7: open water" [disabled] [ref=e116]'
      - 'button "G7: open water" [disabled] [ref=e117]'
      - 'button "H7: open water" [disabled] [ref=e118]'
      - 'button "I7: open water" [disabled] [ref=e119]'
      - 'button "J7: open water" [disabled] [ref=e120]'
      - generic [ref=e121]: "8"
      - 'button "A8: open water" [disabled] [ref=e122]'
      - 'button "B8: open water" [disabled] [ref=e123]'
      - 'button "C8: open water" [disabled] [ref=e124]'
      - 'button "D8: open water" [disabled] [ref=e125]'
      - 'button "E8: open water" [disabled] [ref=e126]'
      - 'button "F8: open water" [disabled] [ref=e127]'
      - 'button "G8: open water" [disabled] [ref=e128]'
      - 'button "H8: open water" [disabled] [ref=e129]'
      - 'button "I8: open water" [disabled] [ref=e130]'
      - 'button "J8: open water" [disabled] [ref=e131]'
      - generic [ref=e132]: "9"
      - 'button "A9: open water" [disabled] [ref=e133]'
      - 'button "B9: open water" [disabled] [ref=e134]'
      - 'button "C9: open water" [disabled] [ref=e135]'
      - 'button "D9: open water" [disabled] [ref=e136]'
      - 'button "E9: open water" [disabled] [ref=e137]'
      - 'button "F9: open water" [disabled] [ref=e138]'
      - 'button "G9: open water" [disabled] [ref=e139]'
      - 'button "H9: open water" [disabled] [ref=e140]'
      - 'button "I9: open water" [disabled] [ref=e141]'
      - 'button "J9: open water" [disabled] [ref=e142]'
      - generic [ref=e143]: "10"
      - 'button "A10: open water" [disabled] [ref=e144]'
      - 'button "B10: open water" [disabled] [ref=e145]'
      - 'button "C10: open water" [disabled] [ref=e146]'
      - 'button "D10: open water" [disabled] [ref=e147]'
      - 'button "E10: open water" [disabled] [ref=e148]'
      - 'button "F10: open water" [disabled] [ref=e149]'
      - 'button "G10: open water" [disabled] [ref=e150]'
      - 'button "H10: open water" [disabled] [ref=e151]'
      - 'button "I10: open water" [disabled] [ref=e152]'
      - 'button "J10: open water" [disabled] [ref=e153]'
    - group "Ships" [ref=e154]:
      - generic [ref=e155]: Ships
      - generic [ref=e156]:
        - generic [ref=e157]:
          - radio "Carrier A1, across" [disabled] [ref=e158]
          - generic [ref=e159]: Carrier
          - generic [ref=e160]: A1, across
        - generic [ref=e161]:
          - radio "Battleship A3, down" [disabled] [ref=e162]
          - generic [ref=e163]: Battleship
          - generic [ref=e164]: A3, down
        - generic [ref=e165]:
          - radio "Cruiser C3, down" [disabled] [ref=e166]
          - generic [ref=e167]: Cruiser
          - generic [ref=e168]: C3, down
        - generic [ref=e169]:
          - radio "Submarine E3, down" [disabled] [ref=e170]
          - generic [ref=e171]: Submarine
          - generic [ref=e172]: E3, down
        - generic [ref=e173]:
          - radio "Destroyer G3, down" [disabled] [ref=e174]
          - generic [ref=e175]: Destroyer
          - generic [ref=e176]: G3, down
```

# Test source

```ts
  1  | // @io-wall-ok — browser verification adapter; all requests stay on the static server.
  2  | import { expect, type Page } from '@playwright/test';
  3  | import axe from 'axe-core';
  4  | import type { visualScenarios } from '../../storybook/scenarios';
  5  | 
  6  | /** The same readiness, accessibility and pixel contract for every canvas. */
  7  | export async function verifyStoryScenario(
  8  |   page: Page,
  9  |   storyId: string,
  10 |   scenario: ReturnType<typeof visualScenarios>[number]
  11 | ): Promise<void> {
  12 |   const { width, height, theme } = scenario;
  13 |   await page.setViewportSize({ width, height });
  14 |   const failures: string[] = [];
  15 |   page.on('pageerror', (error) => failures.push(error.message));
  16 |   await page.route('**/*', (route) =>
  17 |     new URL(route.request().url()).hostname === '127.0.0.1'
  18 |       ? route.continue()
  19 |       : route.abort()
  20 |   );
  21 |   await page.goto(
  22 |     `/iframe.html?id=${storyId}&viewMode=story&globals=theme:${theme}`
  23 |   );
  24 |   await expect
  25 |     .poll(async () =>
  26 |       page.locator('#storybook-root').evaluate((root) => {
  27 |         const status = root.getAttribute('data-story-status');
  28 |         if (status === 'error')
  29 |           return `error: ${root.getAttribute('data-story-error') ?? 'Storybook reported a failure'}`;
  30 |         return root.getAttribute('data-story-ready') === 'true'
  31 |           ? 'success'
  32 |           : 'pending';
  33 |       })
  34 |     )
  35 |     .toBe('success');
  36 |   await expect(page.locator('.sb-errordisplay')).not.toBeVisible();
  37 |   await page.evaluate(() => document.fonts.ready);
  38 |   await page.addScriptTag({ content: axe.source });
  39 |   const violations = await page.evaluate(async () => {
  40 |     const root = document.querySelector<HTMLElement>('#storybook-root');
  41 |     if (!root) throw new Error('Storybook canvas is missing');
  42 |     const result = await (window as unknown as { axe: typeof axe }).axe.run(
  43 |       root
  44 |     );
  45 |     return result.violations.filter(
  46 |       (v) => v.impact === 'serious' || v.impact === 'critical'
  47 |     );
  48 |   });
  49 |   expect(violations).toEqual([]);
  50 |   expect(failures).toEqual([]);
> 51 |   await expect(page.locator('#storybook-root')).toHaveScreenshot(
     |                                                 ^ Error: expect(locator).toHaveScreenshot(expected) failed
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```