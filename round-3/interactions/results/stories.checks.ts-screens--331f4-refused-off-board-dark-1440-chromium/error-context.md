# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--refused-off-board dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  50821 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/refused-off-board-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/refused-off-board-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 50821 pixels (ratio 0.05 of all image pixels) are different.
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
  - 50821 pixels (ratio 0.05 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: 0 of 5 ships placed.
    - generic [ref=e15]:
      - button "Rotate down" [ref=e16] [cursor=pointer]:
        - paragraph [ref=e19]: Rotate down
      - button "Remove" [disabled] [ref=e20]:
        - paragraph [ref=e23]: Remove
    - button "Enlarge placement" [ref=e25] [cursor=pointer]:
      - paragraph [ref=e28]: Enlarge placement
    - group "Your waters" [ref=e29]:
      - generic [ref=e31]: A
      - generic [ref=e32]: B
      - generic [ref=e33]: C
      - generic [ref=e34]: D
      - generic [ref=e35]: E
      - generic [ref=e36]: F
      - generic [ref=e37]: G
      - generic [ref=e38]: H
      - generic [ref=e39]: I
      - generic [ref=e40]: J
      - generic [ref=e41]: "1"
      - 'button "A1: open water" [ref=e42] [cursor=pointer]'
      - 'button "B1: open water" [ref=e43] [cursor=pointer]'
      - 'button "C1: open water" [ref=e44] [cursor=pointer]'
      - 'button "D1: open water" [ref=e45] [cursor=pointer]'
      - 'button "E1: open water" [ref=e46] [cursor=pointer]'
      - 'button "F1: open water" [ref=e47] [cursor=pointer]'
      - 'button "G1: open water" [ref=e48] [cursor=pointer]'
      - 'button "H1: open water" [ref=e49] [cursor=pointer]'
      - 'button "I1: open water" [ref=e50] [cursor=pointer]'
      - 'button "J1: open water" [active] [ref=e51] [cursor=pointer]':
        - generic: ⊘
      - generic [ref=e52]: "2"
      - 'button "A2: open water" [ref=e53] [cursor=pointer]'
      - 'button "B2: open water" [ref=e54] [cursor=pointer]'
      - 'button "C2: open water" [ref=e55] [cursor=pointer]'
      - 'button "D2: open water" [ref=e56] [cursor=pointer]'
      - 'button "E2: open water" [ref=e57] [cursor=pointer]'
      - 'button "F2: open water" [ref=e58] [cursor=pointer]'
      - 'button "G2: open water" [ref=e59] [cursor=pointer]'
      - 'button "H2: open water" [ref=e60] [cursor=pointer]'
      - 'button "I2: open water" [ref=e61] [cursor=pointer]'
      - 'button "J2: open water" [ref=e62] [cursor=pointer]'
      - generic [ref=e63]: "3"
      - 'button "A3: open water" [ref=e64] [cursor=pointer]'
      - 'button "B3: open water" [ref=e65] [cursor=pointer]'
      - 'button "C3: open water" [ref=e66] [cursor=pointer]'
      - 'button "D3: open water" [ref=e67] [cursor=pointer]'
      - 'button "E3: open water" [ref=e68] [cursor=pointer]'
      - 'button "F3: open water" [ref=e69] [cursor=pointer]'
      - 'button "G3: open water" [ref=e70] [cursor=pointer]'
      - 'button "H3: open water" [ref=e71] [cursor=pointer]'
      - 'button "I3: open water" [ref=e72] [cursor=pointer]'
      - 'button "J3: open water" [ref=e73] [cursor=pointer]'
      - generic [ref=e74]: "4"
      - 'button "A4: open water" [ref=e75] [cursor=pointer]'
      - 'button "B4: open water" [ref=e76] [cursor=pointer]'
      - 'button "C4: open water" [ref=e77] [cursor=pointer]'
      - 'button "D4: open water" [ref=e78] [cursor=pointer]'
      - 'button "E4: open water" [ref=e79] [cursor=pointer]'
      - 'button "F4: open water" [ref=e80] [cursor=pointer]'
      - 'button "G4: open water" [ref=e81] [cursor=pointer]'
      - 'button "H4: open water" [ref=e82] [cursor=pointer]'
      - 'button "I4: open water" [ref=e83] [cursor=pointer]'
      - 'button "J4: open water" [ref=e84] [cursor=pointer]'
      - generic [ref=e85]: "5"
      - 'button "A5: open water" [ref=e86] [cursor=pointer]'
      - 'button "B5: open water" [ref=e87] [cursor=pointer]'
      - 'button "C5: open water" [ref=e88] [cursor=pointer]'
      - 'button "D5: open water" [ref=e89] [cursor=pointer]'
      - 'button "E5: open water" [ref=e90] [cursor=pointer]'
      - 'button "F5: open water" [ref=e91] [cursor=pointer]'
      - 'button "G5: open water" [ref=e92] [cursor=pointer]'
      - 'button "H5: open water" [ref=e93] [cursor=pointer]'
      - 'button "I5: open water" [ref=e94] [cursor=pointer]'
      - 'button "J5: open water" [ref=e95] [cursor=pointer]'
      - generic [ref=e96]: "6"
      - 'button "A6: open water" [ref=e97] [cursor=pointer]'
      - 'button "B6: open water" [ref=e98] [cursor=pointer]'
      - 'button "C6: open water" [ref=e99] [cursor=pointer]'
      - 'button "D6: open water" [ref=e100] [cursor=pointer]'
      - 'button "E6: open water" [ref=e101] [cursor=pointer]'
      - 'button "F6: open water" [ref=e102] [cursor=pointer]'
      - 'button "G6: open water" [ref=e103] [cursor=pointer]'
      - 'button "H6: open water" [ref=e104] [cursor=pointer]'
      - 'button "I6: open water" [ref=e105] [cursor=pointer]'
      - 'button "J6: open water" [ref=e106] [cursor=pointer]'
      - generic [ref=e107]: "7"
      - 'button "A7: open water" [ref=e108] [cursor=pointer]'
      - 'button "B7: open water" [ref=e109] [cursor=pointer]'
      - 'button "C7: open water" [ref=e110] [cursor=pointer]'
      - 'button "D7: open water" [ref=e111] [cursor=pointer]'
      - 'button "E7: open water" [ref=e112] [cursor=pointer]'
      - 'button "F7: open water" [ref=e113] [cursor=pointer]'
      - 'button "G7: open water" [ref=e114] [cursor=pointer]'
      - 'button "H7: open water" [ref=e115] [cursor=pointer]'
      - 'button "I7: open water" [ref=e116] [cursor=pointer]'
      - 'button "J7: open water" [ref=e117] [cursor=pointer]'
      - generic [ref=e118]: "8"
      - 'button "A8: open water" [ref=e119] [cursor=pointer]'
      - 'button "B8: open water" [ref=e120] [cursor=pointer]'
      - 'button "C8: open water" [ref=e121] [cursor=pointer]'
      - 'button "D8: open water" [ref=e122] [cursor=pointer]'
      - 'button "E8: open water" [ref=e123] [cursor=pointer]'
      - 'button "F8: open water" [ref=e124] [cursor=pointer]'
      - 'button "G8: open water" [ref=e125] [cursor=pointer]'
      - 'button "H8: open water" [ref=e126] [cursor=pointer]'
      - 'button "I8: open water" [ref=e127] [cursor=pointer]'
      - 'button "J8: open water" [ref=e128] [cursor=pointer]'
      - generic [ref=e129]: "9"
      - 'button "A9: open water" [ref=e130] [cursor=pointer]'
      - 'button "B9: open water" [ref=e131] [cursor=pointer]'
      - 'button "C9: open water" [ref=e132] [cursor=pointer]'
      - 'button "D9: open water" [ref=e133] [cursor=pointer]'
      - 'button "E9: open water" [ref=e134] [cursor=pointer]'
      - 'button "F9: open water" [ref=e135] [cursor=pointer]'
      - 'button "G9: open water" [ref=e136] [cursor=pointer]'
      - 'button "H9: open water" [ref=e137] [cursor=pointer]'
      - 'button "I9: open water" [ref=e138] [cursor=pointer]'
      - 'button "J9: open water" [ref=e139] [cursor=pointer]'
      - generic [ref=e140]: "10"
      - 'button "A10: open water" [ref=e141] [cursor=pointer]'
      - 'button "B10: open water" [ref=e142] [cursor=pointer]'
      - 'button "C10: open water" [ref=e143] [cursor=pointer]'
      - 'button "D10: open water" [ref=e144] [cursor=pointer]'
      - 'button "E10: open water" [ref=e145] [cursor=pointer]'
      - 'button "F10: open water" [ref=e146] [cursor=pointer]'
      - 'button "G10: open water" [ref=e147] [cursor=pointer]'
      - 'button "H10: open water" [ref=e148] [cursor=pointer]'
      - 'button "I10: open water" [ref=e149] [cursor=pointer]'
      - 'button "J10: open water" [ref=e150] [cursor=pointer]'
    - alert [ref=e151]:
      - img [ref=e154]
      - generic [ref=e156]: "The Carrier does not fit there: it would run off the board. Choose another bow cell or rotate the ship, then try again."
    - group "Ships" [ref=e157]:
      - generic [ref=e158]: Ships
      - generic [ref=e159]:
        - generic [ref=e160] [cursor=pointer]:
          - radio "Carrier 5 cells" [checked] [ref=e161]
          - generic [ref=e162]: Carrier
          - generic [ref=e163]: 5 cells
        - generic [ref=e164] [cursor=pointer]:
          - radio "Battleship 4 cells" [ref=e165]
          - generic [ref=e166]: Battleship
          - generic [ref=e167]: 4 cells
        - generic [ref=e168] [cursor=pointer]:
          - radio "Cruiser 3 cells" [ref=e169]
          - generic [ref=e170]: Cruiser
          - generic [ref=e171]: 3 cells
        - generic [ref=e172] [cursor=pointer]:
          - radio "Submarine 3 cells" [ref=e173]
          - generic [ref=e174]: Submarine
          - generic [ref=e175]: 3 cells
        - generic [ref=e176] [cursor=pointer]:
          - radio "Destroyer 2 cells" [ref=e177]
          - generic [ref=e178]: Destroyer
          - generic [ref=e179]: 2 cells
    - paragraph [ref=e180]: "Carrier: 5 cells across. Tap its first cell to place it; use Rotate to change direction."
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