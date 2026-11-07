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
  48905 pixels (ratio 0.05 of all image pixels) are different.

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
  - 48905 pixels (ratio 0.05 of all image pixels) are different.
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
  - 48905 pixels (ratio 0.05 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: All five ships placed. Your fleet is ready.
    - generic [ref=e15]:
      - img [ref=e18]
      - generic [ref=e20]: Your fleet is locked in and can no longer change.
    - group "Ships" [ref=e21]:
      - generic [ref=e22]: Ships
      - generic [ref=e23]:
        - generic [ref=e24]:
          - radio "Carrier A1, across" [disabled] [ref=e25]
          - generic [ref=e26]: Carrier
          - generic [ref=e27]: A1, across
        - generic [ref=e28]:
          - radio "Battleship A3, down" [disabled] [ref=e29]
          - generic [ref=e30]: Battleship
          - generic [ref=e31]: A3, down
        - generic [ref=e32]:
          - radio "Cruiser C3, down" [disabled] [ref=e33]
          - generic [ref=e34]: Cruiser
          - generic [ref=e35]: C3, down
        - generic [ref=e36]:
          - radio "Submarine E3, down" [disabled] [ref=e37]
          - generic [ref=e38]: Submarine
          - generic [ref=e39]: E3, down
        - generic [ref=e40]:
          - radio "Destroyer G3, down" [disabled] [ref=e41]
          - generic [ref=e42]: Destroyer
          - generic [ref=e43]: G3, down
    - generic [ref=e44]:
      - button "Enlarge placement" [disabled] [ref=e45]:
        - paragraph [ref=e48]: Enlarge placement
      - generic [ref=e49]:
        - generic [ref=e50]:
          - button "Rotate down" [disabled] [ref=e51]:
            - paragraph [ref=e54]: Rotate down
          - button "Remove" [disabled] [ref=e55]:
            - paragraph [ref=e58]: Remove
        - group "Your waters" [ref=e59]:
          - generic [ref=e61]: A
          - generic [ref=e62]: B
          - generic [ref=e63]: C
          - generic [ref=e64]: D
          - generic [ref=e65]: E
          - generic [ref=e66]: F
          - generic [ref=e67]: G
          - generic [ref=e68]: H
          - generic [ref=e69]: I
          - generic [ref=e70]: J
          - generic [ref=e71]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e72]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e73]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e74]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e75]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e76]':
            - generic: ■
          - 'button "F1: open water" [disabled] [ref=e77]'
          - 'button "G1: open water" [disabled] [ref=e78]'
          - 'button "H1: open water" [disabled] [ref=e79]'
          - 'button "I1: open water" [disabled] [ref=e80]'
          - 'button "J1: open water" [disabled] [ref=e81]'
          - generic [ref=e82]: "2"
          - 'button "A2: open water" [disabled] [ref=e83]'
          - 'button "B2: open water" [disabled] [ref=e84]'
          - 'button "C2: open water" [disabled] [ref=e85]'
          - 'button "D2: open water" [disabled] [ref=e86]'
          - 'button "E2: open water" [disabled] [ref=e87]'
          - 'button "F2: open water" [disabled] [ref=e88]'
          - 'button "G2: open water" [disabled] [ref=e89]'
          - 'button "H2: open water" [disabled] [ref=e90]'
          - 'button "I2: open water" [disabled] [ref=e91]'
          - 'button "J2: open water" [disabled] [ref=e92]'
          - generic [ref=e93]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e94]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e95]'
          - 'button "C3: Cruiser" [disabled] [ref=e96]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e97]'
          - 'button "E3: Submarine" [disabled] [ref=e98]':
            - generic: ■
          - 'button "F3: open water" [disabled] [ref=e99]'
          - 'button "G3: Destroyer" [disabled] [ref=e100]':
            - generic: ■
          - 'button "H3: open water" [disabled] [ref=e101]'
          - 'button "I3: open water" [disabled] [ref=e102]'
          - 'button "J3: open water" [disabled] [ref=e103]'
          - generic [ref=e104]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e105]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e106]'
          - 'button "C4: Cruiser" [disabled] [ref=e107]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e108]'
          - 'button "E4: Submarine" [disabled] [ref=e109]':
            - generic: ■
          - 'button "F4: open water" [disabled] [ref=e110]'
          - 'button "G4: Destroyer" [disabled] [ref=e111]':
            - generic: ■
          - 'button "H4: open water" [disabled] [ref=e112]'
          - 'button "I4: open water" [disabled] [ref=e113]'
          - 'button "J4: open water" [disabled] [ref=e114]'
          - generic [ref=e115]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e116]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e117]'
          - 'button "C5: Cruiser" [disabled] [ref=e118]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e119]'
          - 'button "E5: Submarine" [disabled] [ref=e120]':
            - generic: ■
          - 'button "F5: open water" [disabled] [ref=e121]'
          - 'button "G5: open water" [disabled] [ref=e122]'
          - 'button "H5: open water" [disabled] [ref=e123]'
          - 'button "I5: open water" [disabled] [ref=e124]'
          - 'button "J5: open water" [disabled] [ref=e125]'
          - generic [ref=e126]: "6"
          - 'button "A6: Battleship" [disabled] [ref=e127]':
            - generic: ■
          - 'button "B6: open water" [disabled] [ref=e128]'
          - 'button "C6: open water" [disabled] [ref=e129]'
          - 'button "D6: open water" [disabled] [ref=e130]'
          - 'button "E6: open water" [disabled] [ref=e131]'
          - 'button "F6: open water" [disabled] [ref=e132]'
          - 'button "G6: open water" [disabled] [ref=e133]'
          - 'button "H6: open water" [disabled] [ref=e134]'
          - 'button "I6: open water" [disabled] [ref=e135]'
          - 'button "J6: open water" [disabled] [ref=e136]'
          - generic [ref=e137]: "7"
          - 'button "A7: open water" [disabled] [ref=e138]'
          - 'button "B7: open water" [disabled] [ref=e139]'
          - 'button "C7: open water" [disabled] [ref=e140]'
          - 'button "D7: open water" [disabled] [ref=e141]'
          - 'button "E7: open water" [disabled] [ref=e142]'
          - 'button "F7: open water" [disabled] [ref=e143]'
          - 'button "G7: open water" [disabled] [ref=e144]'
          - 'button "H7: open water" [disabled] [ref=e145]'
          - 'button "I7: open water" [disabled] [ref=e146]'
          - 'button "J7: open water" [disabled] [ref=e147]'
          - generic [ref=e148]: "8"
          - 'button "A8: open water" [disabled] [ref=e149]'
          - 'button "B8: open water" [disabled] [ref=e150]'
          - 'button "C8: open water" [disabled] [ref=e151]'
          - 'button "D8: open water" [disabled] [ref=e152]'
          - 'button "E8: open water" [disabled] [ref=e153]'
          - 'button "F8: open water" [disabled] [ref=e154]'
          - 'button "G8: open water" [disabled] [ref=e155]'
          - 'button "H8: open water" [disabled] [ref=e156]'
          - 'button "I8: open water" [disabled] [ref=e157]'
          - 'button "J8: open water" [disabled] [ref=e158]'
          - generic [ref=e159]: "9"
          - 'button "A9: open water" [disabled] [ref=e160]'
          - 'button "B9: open water" [disabled] [ref=e161]'
          - 'button "C9: open water" [disabled] [ref=e162]'
          - 'button "D9: open water" [disabled] [ref=e163]'
          - 'button "E9: open water" [disabled] [ref=e164]'
          - 'button "F9: open water" [disabled] [ref=e165]'
          - 'button "G9: open water" [disabled] [ref=e166]'
          - 'button "H9: open water" [disabled] [ref=e167]'
          - 'button "I9: open water" [disabled] [ref=e168]'
          - 'button "J9: open water" [disabled] [ref=e169]'
          - generic [ref=e170]: "10"
          - 'button "A10: open water" [disabled] [ref=e171]'
          - 'button "B10: open water" [disabled] [ref=e172]'
          - 'button "C10: open water" [disabled] [ref=e173]'
          - 'button "D10: open water" [disabled] [ref=e174]'
          - 'button "E10: open water" [disabled] [ref=e175]'
          - 'button "F10: open water" [disabled] [ref=e176]'
          - 'button "G10: open water" [disabled] [ref=e177]'
          - 'button "H10: open water" [disabled] [ref=e178]'
          - 'button "I10: open water" [disabled] [ref=e179]'
          - 'button "J10: open water" [disabled] [ref=e180]'
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