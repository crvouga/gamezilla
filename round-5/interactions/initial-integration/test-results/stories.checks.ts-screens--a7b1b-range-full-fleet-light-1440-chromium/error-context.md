# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--arrange-full-fleet light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  52997 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/arrange-full-fleet-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/arrange-full-fleet-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 52997 pixels (ratio 0.05 of all image pixels) are different.
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
  - 52997 pixels (ratio 0.05 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: All five ships placed. Your fleet is ready.
    - group "Ships" [ref=e15]:
      - generic [ref=e16]: Ships
      - generic [ref=e17]:
        - generic [ref=e18] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e19]
          - generic [ref=e20]: Carrier
          - generic [ref=e21]: A1, across
        - generic [ref=e22] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e23]
          - generic [ref=e24]: Battleship
          - generic [ref=e25]: A3, down
        - generic [ref=e26] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e27]
          - generic [ref=e28]: Cruiser
          - generic [ref=e29]: C3, down
        - generic [ref=e30] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e31]
          - generic [ref=e32]: Submarine
          - generic [ref=e33]: E3, down
        - generic [ref=e34] [cursor=pointer]:
          - radio "Destroyer I7, down" [ref=e35]
          - generic [ref=e36]: Destroyer
          - generic [ref=e37]: I7, down
    - generic [ref=e38]:
      - button "Enlarge placement" [ref=e39] [cursor=pointer]:
        - paragraph [ref=e42]: Enlarge placement
      - generic [ref=e43]:
        - generic [ref=e44]:
          - button "Rotate across" [disabled] [ref=e45]:
            - paragraph [ref=e48]: Rotate across
          - button "Remove" [disabled] [ref=e49]:
            - paragraph [ref=e52]: Remove
        - paragraph [ref=e53]: Choose a placed ship to move or remove it.
        - group "Your waters" [ref=e54]:
          - generic [ref=e56]: A
          - generic [ref=e57]: B
          - generic [ref=e58]: C
          - generic [ref=e59]: D
          - generic [ref=e60]: E
          - generic [ref=e61]: F
          - generic [ref=e62]: G
          - generic [ref=e63]: H
          - generic [ref=e64]: I
          - generic [ref=e65]: J
          - generic [ref=e66]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e67]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e68]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e69]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e70]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e71]':
            - generic: ■
          - 'button "F1: open water" [disabled] [ref=e72]'
          - 'button "G1: open water" [disabled] [ref=e73]'
          - 'button "H1: open water" [disabled] [ref=e74]'
          - 'button "I1: open water" [disabled] [ref=e75]'
          - 'button "J1: open water" [disabled] [ref=e76]'
          - generic [ref=e77]: "2"
          - 'button "A2: open water" [disabled] [ref=e78]'
          - 'button "B2: open water" [disabled] [ref=e79]'
          - 'button "C2: open water" [disabled] [ref=e80]'
          - 'button "D2: open water" [disabled] [ref=e81]'
          - 'button "E2: open water" [disabled] [ref=e82]'
          - 'button "F2: open water" [disabled] [ref=e83]'
          - 'button "G2: open water" [disabled] [ref=e84]'
          - 'button "H2: open water" [disabled] [ref=e85]'
          - 'button "I2: open water" [disabled] [ref=e86]'
          - 'button "J2: open water" [disabled] [ref=e87]'
          - generic [ref=e88]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e89]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e90]'
          - 'button "C3: Cruiser" [disabled] [ref=e91]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e92]'
          - 'button "E3: Submarine" [disabled] [ref=e93]':
            - generic: ■
          - 'button "F3: open water" [disabled] [ref=e94]'
          - 'button "G3: open water" [disabled] [ref=e95]'
          - 'button "H3: open water" [disabled] [ref=e96]'
          - 'button "I3: open water" [disabled] [ref=e97]'
          - 'button "J3: open water" [disabled] [ref=e98]'
          - generic [ref=e99]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e100]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e101]'
          - 'button "C4: Cruiser" [disabled] [ref=e102]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e103]'
          - 'button "E4: Submarine" [disabled] [ref=e104]':
            - generic: ■
          - 'button "F4: open water" [disabled] [ref=e105]'
          - 'button "G4: open water" [disabled] [ref=e106]'
          - 'button "H4: open water" [disabled] [ref=e107]'
          - 'button "I4: open water" [disabled] [ref=e108]'
          - 'button "J4: open water" [disabled] [ref=e109]'
          - generic [ref=e110]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e111]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e112]'
          - 'button "C5: Cruiser" [disabled] [ref=e113]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e114]'
          - 'button "E5: Submarine" [disabled] [ref=e115]':
            - generic: ■
          - 'button "F5: open water" [disabled] [ref=e116]'
          - 'button "G5: open water" [disabled] [ref=e117]'
          - 'button "H5: open water" [disabled] [ref=e118]'
          - 'button "I5: open water" [disabled] [ref=e119]'
          - 'button "J5: open water" [disabled] [ref=e120]'
          - generic [ref=e121]: "6"
          - 'button "A6: Battleship" [disabled] [ref=e122]':
            - generic: ■
          - 'button "B6: open water" [disabled] [ref=e123]'
          - 'button "C6: open water" [disabled] [ref=e124]'
          - 'button "D6: open water" [disabled] [ref=e125]'
          - 'button "E6: open water" [disabled] [ref=e126]'
          - 'button "F6: open water" [disabled] [ref=e127]'
          - 'button "G6: open water" [disabled] [ref=e128]'
          - 'button "H6: open water" [disabled] [ref=e129]'
          - 'button "I6: open water" [disabled] [ref=e130]'
          - 'button "J6: open water" [disabled] [ref=e131]'
          - generic [ref=e132]: "7"
          - 'button "A7: open water" [disabled] [ref=e133]'
          - 'button "B7: open water" [disabled] [ref=e134]'
          - 'button "C7: open water" [disabled] [ref=e135]'
          - 'button "D7: open water" [disabled] [ref=e136]'
          - 'button "E7: open water" [disabled] [ref=e137]'
          - 'button "F7: open water" [disabled] [ref=e138]'
          - 'button "G7: open water" [disabled] [ref=e139]'
          - 'button "H7: open water" [disabled] [ref=e140]'
          - 'button "I7: Destroyer" [disabled] [active] [ref=e141]':
            - generic: ■
          - 'button "J7: open water" [disabled] [ref=e142]'
          - generic [ref=e143]: "8"
          - 'button "A8: open water" [disabled] [ref=e144]'
          - 'button "B8: open water" [disabled] [ref=e145]'
          - 'button "C8: open water" [disabled] [ref=e146]'
          - 'button "D8: open water" [disabled] [ref=e147]'
          - 'button "E8: open water" [disabled] [ref=e148]'
          - 'button "F8: open water" [disabled] [ref=e149]'
          - 'button "G8: open water" [disabled] [ref=e150]'
          - 'button "H8: open water" [disabled] [ref=e151]'
          - 'button "I8: Destroyer" [disabled] [ref=e152]':
            - generic: ■
          - 'button "J8: open water" [disabled] [ref=e153]'
          - generic [ref=e154]: "9"
          - 'button "A9: open water" [disabled] [ref=e155]'
          - 'button "B9: open water" [disabled] [ref=e156]'
          - 'button "C9: open water" [disabled] [ref=e157]'
          - 'button "D9: open water" [disabled] [ref=e158]'
          - 'button "E9: open water" [disabled] [ref=e159]'
          - 'button "F9: open water" [disabled] [ref=e160]'
          - 'button "G9: open water" [disabled] [ref=e161]'
          - 'button "H9: open water" [disabled] [ref=e162]'
          - 'button "I9: open water" [disabled] [ref=e163]'
          - 'button "J9: open water" [disabled] [ref=e164]'
          - generic [ref=e165]: "10"
          - 'button "A10: open water" [disabled] [ref=e166]'
          - 'button "B10: open water" [disabled] [ref=e167]'
          - 'button "C10: open water" [disabled] [ref=e168]'
          - 'button "D10: open water" [disabled] [ref=e169]'
          - 'button "E10: open water" [disabled] [ref=e170]'
          - 'button "F10: open water" [disabled] [ref=e171]'
          - 'button "G10: open water" [disabled] [ref=e172]'
          - 'button "H10: open water" [disabled] [ref=e173]'
          - 'button "I10: open water" [disabled] [ref=e174]'
          - 'button "J10: open water" [disabled] [ref=e175]'
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