# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--complete light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  55783 pixels (ratio 0.17 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/complete-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/complete-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 55783 pixels (ratio 0.17 of all image pixels) are different.
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
  - 55783 pixels (ratio 0.17 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - generic [ref=e12]:
      - button "Rotate down" [disabled] [ref=e13]:
        - paragraph [ref=e16]: Rotate down
      - button "Remove" [disabled] [ref=e17]:
        - paragraph [ref=e20]: Remove
    - generic [ref=e21]:
      - button "Enlarge placement" [ref=e22] [cursor=pointer]:
        - paragraph [ref=e25]: Enlarge placement
      - group "Your waters" [ref=e26]:
        - generic [ref=e28]: A
        - generic [ref=e29]: B
        - generic [ref=e30]: C
        - generic [ref=e31]: D
        - generic [ref=e32]: E
        - generic [ref=e33]: F
        - generic [ref=e34]: G
        - generic [ref=e35]: H
        - generic [ref=e36]: I
        - generic [ref=e37]: J
        - generic [ref=e38]: "1"
        - 'button "A1: Carrier" [disabled] [ref=e39]':
          - generic: ■
        - 'button "B1: Carrier" [disabled] [ref=e40]':
          - generic: ■
        - 'button "C1: Carrier" [disabled] [ref=e41]':
          - generic: ■
        - 'button "D1: Carrier" [disabled] [ref=e42]':
          - generic: ■
        - 'button "E1: Carrier" [disabled] [ref=e43]':
          - generic: ■
        - 'button "F1: open water" [disabled] [ref=e44]'
        - 'button "G1: open water" [disabled] [ref=e45]'
        - 'button "H1: open water" [disabled] [ref=e46]'
        - 'button "I1: open water" [disabled] [ref=e47]'
        - 'button "J1: open water" [disabled] [ref=e48]'
        - generic [ref=e49]: "2"
        - 'button "A2: open water" [disabled] [ref=e50]'
        - 'button "B2: open water" [disabled] [ref=e51]'
        - 'button "C2: open water" [disabled] [ref=e52]'
        - 'button "D2: open water" [disabled] [ref=e53]'
        - 'button "E2: open water" [disabled] [ref=e54]'
        - 'button "F2: open water" [disabled] [ref=e55]'
        - 'button "G2: open water" [disabled] [ref=e56]'
        - 'button "H2: open water" [disabled] [ref=e57]'
        - 'button "I2: open water" [disabled] [ref=e58]'
        - 'button "J2: open water" [disabled] [ref=e59]'
        - generic [ref=e60]: "3"
        - 'button "A3: Battleship" [disabled] [ref=e61]':
          - generic: ■
        - 'button "B3: open water" [disabled] [ref=e62]'
        - 'button "C3: Cruiser" [disabled] [ref=e63]':
          - generic: ■
        - 'button "D3: open water" [disabled] [ref=e64]'
        - 'button "E3: Submarine" [disabled] [ref=e65]':
          - generic: ■
        - 'button "F3: open water" [disabled] [ref=e66]'
        - 'button "G3: Destroyer" [disabled] [ref=e67]':
          - generic: ■
        - 'button "H3: open water" [disabled] [ref=e68]'
        - 'button "I3: open water" [disabled] [ref=e69]'
        - 'button "J3: open water" [disabled] [ref=e70]'
        - generic [ref=e71]: "4"
        - 'button "A4: Battleship" [disabled] [ref=e72]':
          - generic: ■
        - 'button "B4: open water" [disabled] [ref=e73]'
        - 'button "C4: Cruiser" [disabled] [ref=e74]':
          - generic: ■
        - 'button "D4: open water" [disabled] [ref=e75]'
        - 'button "E4: Submarine" [disabled] [ref=e76]':
          - generic: ■
        - 'button "F4: open water" [disabled] [ref=e77]'
        - 'button "G4: Destroyer" [disabled] [ref=e78]':
          - generic: ■
        - 'button "H4: open water" [disabled] [ref=e79]'
        - 'button "I4: open water" [disabled] [ref=e80]'
        - 'button "J4: open water" [disabled] [ref=e81]'
        - generic [ref=e82]: "5"
        - 'button "A5: Battleship" [disabled] [ref=e83]':
          - generic: ■
        - 'button "B5: open water" [disabled] [ref=e84]'
        - 'button "C5: Cruiser" [disabled] [ref=e85]':
          - generic: ■
        - 'button "D5: open water" [disabled] [ref=e86]'
        - 'button "E5: Submarine" [disabled] [ref=e87]':
          - generic: ■
        - 'button "F5: open water" [disabled] [ref=e88]'
        - 'button "G5: open water" [disabled] [ref=e89]'
        - 'button "H5: open water" [disabled] [ref=e90]'
        - 'button "I5: open water" [disabled] [ref=e91]'
        - 'button "J5: open water" [disabled] [ref=e92]'
        - generic [ref=e93]: "6"
        - 'button "A6: Battleship" [disabled] [ref=e94]':
          - generic: ■
        - 'button "B6: open water" [disabled] [ref=e95]'
        - 'button "C6: open water" [disabled] [ref=e96]'
        - 'button "D6: open water" [disabled] [ref=e97]'
        - 'button "E6: open water" [disabled] [ref=e98]'
        - 'button "F6: open water" [disabled] [ref=e99]'
        - 'button "G6: open water" [disabled] [ref=e100]'
        - 'button "H6: open water" [disabled] [ref=e101]'
        - 'button "I6: open water" [disabled] [ref=e102]'
        - 'button "J6: open water" [disabled] [ref=e103]'
        - generic [ref=e104]: "7"
        - 'button "A7: open water" [disabled] [ref=e105]'
        - 'button "B7: open water" [disabled] [ref=e106]'
        - 'button "C7: open water" [disabled] [ref=e107]'
        - 'button "D7: open water" [disabled] [ref=e108]'
        - 'button "E7: open water" [disabled] [ref=e109]'
        - 'button "F7: open water" [disabled] [ref=e110]'
        - 'button "G7: open water" [disabled] [ref=e111]'
        - 'button "H7: open water" [disabled] [ref=e112]'
        - 'button "I7: open water" [disabled] [ref=e113]'
        - 'button "J7: open water" [disabled] [ref=e114]'
        - generic [ref=e115]: "8"
        - 'button "A8: open water" [disabled] [ref=e116]'
        - 'button "B8: open water" [disabled] [ref=e117]'
        - 'button "C8: open water" [disabled] [ref=e118]'
        - 'button "D8: open water" [disabled] [ref=e119]'
        - 'button "E8: open water" [disabled] [ref=e120]'
        - 'button "F8: open water" [disabled] [ref=e121]'
        - 'button "G8: open water" [disabled] [ref=e122]'
        - 'button "H8: open water" [disabled] [ref=e123]'
        - 'button "I8: open water" [disabled] [ref=e124]'
        - 'button "J8: open water" [disabled] [ref=e125]'
        - generic [ref=e126]: "9"
        - 'button "A9: open water" [disabled] [ref=e127]'
        - 'button "B9: open water" [disabled] [ref=e128]'
        - 'button "C9: open water" [disabled] [ref=e129]'
        - 'button "D9: open water" [disabled] [ref=e130]'
        - 'button "E9: open water" [disabled] [ref=e131]'
        - 'button "F9: open water" [disabled] [ref=e132]'
        - 'button "G9: open water" [disabled] [ref=e133]'
        - 'button "H9: open water" [disabled] [ref=e134]'
        - 'button "I9: open water" [disabled] [ref=e135]'
        - 'button "J9: open water" [disabled] [ref=e136]'
        - generic [ref=e137]: "10"
        - 'button "A10: open water" [disabled] [ref=e138]'
        - 'button "B10: open water" [disabled] [ref=e139]'
        - 'button "C10: open water" [disabled] [ref=e140]'
        - 'button "D10: open water" [disabled] [ref=e141]'
        - 'button "E10: open water" [disabled] [ref=e142]'
        - 'button "F10: open water" [disabled] [ref=e143]'
        - 'button "G10: open water" [disabled] [ref=e144]'
        - 'button "H10: open water" [disabled] [ref=e145]'
        - 'button "I10: open water" [disabled] [ref=e146]'
        - 'button "J10: open water" [disabled] [ref=e147]'
    - group "Ships" [ref=e148]:
      - generic [ref=e149]: Ships
      - generic [ref=e150]:
        - generic [ref=e151] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e152]
          - generic [ref=e153]: Carrier
          - generic [ref=e154]: A1, across
        - generic [ref=e155] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e156]
          - generic [ref=e157]: Battleship
          - generic [ref=e158]: A3, down
        - generic [ref=e159] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e160]
          - generic [ref=e161]: Cruiser
          - generic [ref=e162]: C3, down
        - generic [ref=e163] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e164]
          - generic [ref=e165]: Submarine
          - generic [ref=e166]: E3, down
        - generic [ref=e167] [cursor=pointer]:
          - radio "Destroyer G3, down" [ref=e168]
          - generic [ref=e169]: Destroyer
          - generic [ref=e170]: G3, down
    - paragraph [ref=e171]: Choose a placed ship to move or remove it.
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