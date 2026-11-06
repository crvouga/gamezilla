# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--locked light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  77904 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 77904 pixels (ratio 0.07 of all image pixels) are different.
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
  - 77904 pixels (ratio 0.07 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: All five ships placed. Your fleet is ready.
    - generic [ref=e15]:
      - img [ref=e18]
      - generic [ref=e20]: Your fleet is locked in and can no longer change.
    - generic [ref=e21]:
      - button "Rotate down" [disabled] [ref=e22]:
        - paragraph [ref=e25]: Rotate down
      - button "Remove" [disabled] [ref=e26]:
        - paragraph [ref=e29]: Remove
    - generic [ref=e30]:
      - button "Enlarge placement" [disabled] [ref=e31]:
        - paragraph [ref=e34]: Enlarge placement
      - group "Your waters" [ref=e35]:
        - generic [ref=e37]: A
        - generic [ref=e38]: B
        - generic [ref=e39]: C
        - generic [ref=e40]: D
        - generic [ref=e41]: E
        - generic [ref=e42]: F
        - generic [ref=e43]: G
        - generic [ref=e44]: H
        - generic [ref=e45]: I
        - generic [ref=e46]: J
        - generic [ref=e47]: "1"
        - 'button "A1: Carrier" [disabled] [ref=e48]':
          - generic: ■
        - 'button "B1: Carrier" [disabled] [ref=e49]':
          - generic: ■
        - 'button "C1: Carrier" [disabled] [ref=e50]':
          - generic: ■
        - 'button "D1: Carrier" [disabled] [ref=e51]':
          - generic: ■
        - 'button "E1: Carrier" [disabled] [ref=e52]':
          - generic: ■
        - 'button "F1: open water" [disabled] [ref=e53]'
        - 'button "G1: open water" [disabled] [ref=e54]'
        - 'button "H1: open water" [disabled] [ref=e55]'
        - 'button "I1: open water" [disabled] [ref=e56]'
        - 'button "J1: open water" [disabled] [ref=e57]'
        - generic [ref=e58]: "2"
        - 'button "A2: open water" [disabled] [ref=e59]'
        - 'button "B2: open water" [disabled] [ref=e60]'
        - 'button "C2: open water" [disabled] [ref=e61]'
        - 'button "D2: open water" [disabled] [ref=e62]'
        - 'button "E2: open water" [disabled] [ref=e63]'
        - 'button "F2: open water" [disabled] [ref=e64]'
        - 'button "G2: open water" [disabled] [ref=e65]'
        - 'button "H2: open water" [disabled] [ref=e66]'
        - 'button "I2: open water" [disabled] [ref=e67]'
        - 'button "J2: open water" [disabled] [ref=e68]'
        - generic [ref=e69]: "3"
        - 'button "A3: Battleship" [disabled] [ref=e70]':
          - generic: ■
        - 'button "B3: open water" [disabled] [ref=e71]'
        - 'button "C3: Cruiser" [disabled] [ref=e72]':
          - generic: ■
        - 'button "D3: open water" [disabled] [ref=e73]'
        - 'button "E3: Submarine" [disabled] [ref=e74]':
          - generic: ■
        - 'button "F3: open water" [disabled] [ref=e75]'
        - 'button "G3: Destroyer" [disabled] [ref=e76]':
          - generic: ■
        - 'button "H3: open water" [disabled] [ref=e77]'
        - 'button "I3: open water" [disabled] [ref=e78]'
        - 'button "J3: open water" [disabled] [ref=e79]'
        - generic [ref=e80]: "4"
        - 'button "A4: Battleship" [disabled] [ref=e81]':
          - generic: ■
        - 'button "B4: open water" [disabled] [ref=e82]'
        - 'button "C4: Cruiser" [disabled] [ref=e83]':
          - generic: ■
        - 'button "D4: open water" [disabled] [ref=e84]'
        - 'button "E4: Submarine" [disabled] [ref=e85]':
          - generic: ■
        - 'button "F4: open water" [disabled] [ref=e86]'
        - 'button "G4: Destroyer" [disabled] [ref=e87]':
          - generic: ■
        - 'button "H4: open water" [disabled] [ref=e88]'
        - 'button "I4: open water" [disabled] [ref=e89]'
        - 'button "J4: open water" [disabled] [ref=e90]'
        - generic [ref=e91]: "5"
        - 'button "A5: Battleship" [disabled] [ref=e92]':
          - generic: ■
        - 'button "B5: open water" [disabled] [ref=e93]'
        - 'button "C5: Cruiser" [disabled] [ref=e94]':
          - generic: ■
        - 'button "D5: open water" [disabled] [ref=e95]'
        - 'button "E5: Submarine" [disabled] [ref=e96]':
          - generic: ■
        - 'button "F5: open water" [disabled] [ref=e97]'
        - 'button "G5: open water" [disabled] [ref=e98]'
        - 'button "H5: open water" [disabled] [ref=e99]'
        - 'button "I5: open water" [disabled] [ref=e100]'
        - 'button "J5: open water" [disabled] [ref=e101]'
        - generic [ref=e102]: "6"
        - 'button "A6: Battleship" [disabled] [ref=e103]':
          - generic: ■
        - 'button "B6: open water" [disabled] [ref=e104]'
        - 'button "C6: open water" [disabled] [ref=e105]'
        - 'button "D6: open water" [disabled] [ref=e106]'
        - 'button "E6: open water" [disabled] [ref=e107]'
        - 'button "F6: open water" [disabled] [ref=e108]'
        - 'button "G6: open water" [disabled] [ref=e109]'
        - 'button "H6: open water" [disabled] [ref=e110]'
        - 'button "I6: open water" [disabled] [ref=e111]'
        - 'button "J6: open water" [disabled] [ref=e112]'
        - generic [ref=e113]: "7"
        - 'button "A7: open water" [disabled] [ref=e114]'
        - 'button "B7: open water" [disabled] [ref=e115]'
        - 'button "C7: open water" [disabled] [ref=e116]'
        - 'button "D7: open water" [disabled] [ref=e117]'
        - 'button "E7: open water" [disabled] [ref=e118]'
        - 'button "F7: open water" [disabled] [ref=e119]'
        - 'button "G7: open water" [disabled] [ref=e120]'
        - 'button "H7: open water" [disabled] [ref=e121]'
        - 'button "I7: open water" [disabled] [ref=e122]'
        - 'button "J7: open water" [disabled] [ref=e123]'
        - generic [ref=e124]: "8"
        - 'button "A8: open water" [disabled] [ref=e125]'
        - 'button "B8: open water" [disabled] [ref=e126]'
        - 'button "C8: open water" [disabled] [ref=e127]'
        - 'button "D8: open water" [disabled] [ref=e128]'
        - 'button "E8: open water" [disabled] [ref=e129]'
        - 'button "F8: open water" [disabled] [ref=e130]'
        - 'button "G8: open water" [disabled] [ref=e131]'
        - 'button "H8: open water" [disabled] [ref=e132]'
        - 'button "I8: open water" [disabled] [ref=e133]'
        - 'button "J8: open water" [disabled] [ref=e134]'
        - generic [ref=e135]: "9"
        - 'button "A9: open water" [disabled] [ref=e136]'
        - 'button "B9: open water" [disabled] [ref=e137]'
        - 'button "C9: open water" [disabled] [ref=e138]'
        - 'button "D9: open water" [disabled] [ref=e139]'
        - 'button "E9: open water" [disabled] [ref=e140]'
        - 'button "F9: open water" [disabled] [ref=e141]'
        - 'button "G9: open water" [disabled] [ref=e142]'
        - 'button "H9: open water" [disabled] [ref=e143]'
        - 'button "I9: open water" [disabled] [ref=e144]'
        - 'button "J9: open water" [disabled] [ref=e145]'
        - generic [ref=e146]: "10"
        - 'button "A10: open water" [disabled] [ref=e147]'
        - 'button "B10: open water" [disabled] [ref=e148]'
        - 'button "C10: open water" [disabled] [ref=e149]'
        - 'button "D10: open water" [disabled] [ref=e150]'
        - 'button "E10: open water" [disabled] [ref=e151]'
        - 'button "F10: open water" [disabled] [ref=e152]'
        - 'button "G10: open water" [disabled] [ref=e153]'
        - 'button "H10: open water" [disabled] [ref=e154]'
        - 'button "I10: open water" [disabled] [ref=e155]'
        - 'button "J10: open water" [disabled] [ref=e156]'
    - group "Ships" [ref=e157]:
      - generic [ref=e158]: Ships
      - generic [ref=e159]:
        - generic [ref=e160]:
          - radio "Carrier A1, across" [disabled] [ref=e161]
          - generic [ref=e162]: Carrier
          - generic [ref=e163]: A1, across
        - generic [ref=e164]:
          - radio "Battleship A3, down" [disabled] [ref=e165]
          - generic [ref=e166]: Battleship
          - generic [ref=e167]: A3, down
        - generic [ref=e168]:
          - radio "Cruiser C3, down" [disabled] [ref=e169]
          - generic [ref=e170]: Cruiser
          - generic [ref=e171]: C3, down
        - generic [ref=e172]:
          - radio "Submarine E3, down" [disabled] [ref=e173]
          - generic [ref=e174]: Submarine
          - generic [ref=e175]: E3, down
        - generic [ref=e176]:
          - radio "Destroyer G3, down" [disabled] [ref=e177]
          - generic [ref=e178]: Destroyer
          - generic [ref=e179]: G3, down
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