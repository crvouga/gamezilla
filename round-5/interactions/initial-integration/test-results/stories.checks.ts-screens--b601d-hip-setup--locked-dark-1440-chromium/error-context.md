# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--locked dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  24134 pixels (ratio 0.02 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 24134 pixels (ratio 0.02 of all image pixels) are different.
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
  - 24134 pixels (ratio 0.02 of all image pixels) are different.

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
        - paragraph [ref=e59]: Choose a placed ship to move or remove it.
        - group "Your waters" [ref=e60]:
          - generic [ref=e62]: A
          - generic [ref=e63]: B
          - generic [ref=e64]: C
          - generic [ref=e65]: D
          - generic [ref=e66]: E
          - generic [ref=e67]: F
          - generic [ref=e68]: G
          - generic [ref=e69]: H
          - generic [ref=e70]: I
          - generic [ref=e71]: J
          - generic [ref=e72]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e73]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e74]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e75]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e76]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e77]':
            - generic: ■
          - 'button "F1: open water" [disabled] [ref=e78]'
          - 'button "G1: open water" [disabled] [ref=e79]'
          - 'button "H1: open water" [disabled] [ref=e80]'
          - 'button "I1: open water" [disabled] [ref=e81]'
          - 'button "J1: open water" [disabled] [ref=e82]'
          - generic [ref=e83]: "2"
          - 'button "A2: open water" [disabled] [ref=e84]'
          - 'button "B2: open water" [disabled] [ref=e85]'
          - 'button "C2: open water" [disabled] [ref=e86]'
          - 'button "D2: open water" [disabled] [ref=e87]'
          - 'button "E2: open water" [disabled] [ref=e88]'
          - 'button "F2: open water" [disabled] [ref=e89]'
          - 'button "G2: open water" [disabled] [ref=e90]'
          - 'button "H2: open water" [disabled] [ref=e91]'
          - 'button "I2: open water" [disabled] [ref=e92]'
          - 'button "J2: open water" [disabled] [ref=e93]'
          - generic [ref=e94]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e95]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e96]'
          - 'button "C3: Cruiser" [disabled] [ref=e97]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e98]'
          - 'button "E3: Submarine" [disabled] [ref=e99]':
            - generic: ■
          - 'button "F3: open water" [disabled] [ref=e100]'
          - 'button "G3: Destroyer" [disabled] [ref=e101]':
            - generic: ■
          - 'button "H3: open water" [disabled] [ref=e102]'
          - 'button "I3: open water" [disabled] [ref=e103]'
          - 'button "J3: open water" [disabled] [ref=e104]'
          - generic [ref=e105]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e106]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e107]'
          - 'button "C4: Cruiser" [disabled] [ref=e108]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e109]'
          - 'button "E4: Submarine" [disabled] [ref=e110]':
            - generic: ■
          - 'button "F4: open water" [disabled] [ref=e111]'
          - 'button "G4: Destroyer" [disabled] [ref=e112]':
            - generic: ■
          - 'button "H4: open water" [disabled] [ref=e113]'
          - 'button "I4: open water" [disabled] [ref=e114]'
          - 'button "J4: open water" [disabled] [ref=e115]'
          - generic [ref=e116]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e117]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e118]'
          - 'button "C5: Cruiser" [disabled] [ref=e119]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e120]'
          - 'button "E5: Submarine" [disabled] [ref=e121]':
            - generic: ■
          - 'button "F5: open water" [disabled] [ref=e122]'
          - 'button "G5: open water" [disabled] [ref=e123]'
          - 'button "H5: open water" [disabled] [ref=e124]'
          - 'button "I5: open water" [disabled] [ref=e125]'
          - 'button "J5: open water" [disabled] [ref=e126]'
          - generic [ref=e127]: "6"
          - 'button "A6: Battleship" [disabled] [ref=e128]':
            - generic: ■
          - 'button "B6: open water" [disabled] [ref=e129]'
          - 'button "C6: open water" [disabled] [ref=e130]'
          - 'button "D6: open water" [disabled] [ref=e131]'
          - 'button "E6: open water" [disabled] [ref=e132]'
          - 'button "F6: open water" [disabled] [ref=e133]'
          - 'button "G6: open water" [disabled] [ref=e134]'
          - 'button "H6: open water" [disabled] [ref=e135]'
          - 'button "I6: open water" [disabled] [ref=e136]'
          - 'button "J6: open water" [disabled] [ref=e137]'
          - generic [ref=e138]: "7"
          - 'button "A7: open water" [disabled] [ref=e139]'
          - 'button "B7: open water" [disabled] [ref=e140]'
          - 'button "C7: open water" [disabled] [ref=e141]'
          - 'button "D7: open water" [disabled] [ref=e142]'
          - 'button "E7: open water" [disabled] [ref=e143]'
          - 'button "F7: open water" [disabled] [ref=e144]'
          - 'button "G7: open water" [disabled] [ref=e145]'
          - 'button "H7: open water" [disabled] [ref=e146]'
          - 'button "I7: open water" [disabled] [ref=e147]'
          - 'button "J7: open water" [disabled] [ref=e148]'
          - generic [ref=e149]: "8"
          - 'button "A8: open water" [disabled] [ref=e150]'
          - 'button "B8: open water" [disabled] [ref=e151]'
          - 'button "C8: open water" [disabled] [ref=e152]'
          - 'button "D8: open water" [disabled] [ref=e153]'
          - 'button "E8: open water" [disabled] [ref=e154]'
          - 'button "F8: open water" [disabled] [ref=e155]'
          - 'button "G8: open water" [disabled] [ref=e156]'
          - 'button "H8: open water" [disabled] [ref=e157]'
          - 'button "I8: open water" [disabled] [ref=e158]'
          - 'button "J8: open water" [disabled] [ref=e159]'
          - generic [ref=e160]: "9"
          - 'button "A9: open water" [disabled] [ref=e161]'
          - 'button "B9: open water" [disabled] [ref=e162]'
          - 'button "C9: open water" [disabled] [ref=e163]'
          - 'button "D9: open water" [disabled] [ref=e164]'
          - 'button "E9: open water" [disabled] [ref=e165]'
          - 'button "F9: open water" [disabled] [ref=e166]'
          - 'button "G9: open water" [disabled] [ref=e167]'
          - 'button "H9: open water" [disabled] [ref=e168]'
          - 'button "I9: open water" [disabled] [ref=e169]'
          - 'button "J9: open water" [disabled] [ref=e170]'
          - generic [ref=e171]: "10"
          - 'button "A10: open water" [disabled] [ref=e172]'
          - 'button "B10: open water" [disabled] [ref=e173]'
          - 'button "C10: open water" [disabled] [ref=e174]'
          - 'button "D10: open water" [disabled] [ref=e175]'
          - 'button "E10: open water" [disabled] [ref=e176]'
          - 'button "F10: open water" [disabled] [ref=e177]'
          - 'button "G10: open water" [disabled] [ref=e178]'
          - 'button "H10: open water" [disabled] [ref=e179]'
          - 'button "I10: open water" [disabled] [ref=e180]'
          - 'button "J10: open water" [disabled] [ref=e181]'
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