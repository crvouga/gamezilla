# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--locked light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  41199 pixels (ratio 0.13 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/locked-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 41199 pixels (ratio 0.13 of all image pixels) are different.
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
  - 41199 pixels (ratio 0.13 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - generic [ref=e12]:
      - img [ref=e15]
      - generic [ref=e17]: Your fleet is locked in and can no longer change.
    - group "Ships" [ref=e18]:
      - generic [ref=e19]: Ships
      - generic [ref=e20]:
        - generic [ref=e21]:
          - radio "Carrier A1, across" [disabled] [ref=e22]
          - generic [ref=e23]: Carrier
          - generic [ref=e24]: A1, across
        - generic [ref=e25]:
          - radio "Battleship A3, down" [disabled] [ref=e26]
          - generic [ref=e27]: Battleship
          - generic [ref=e28]: A3, down
        - generic [ref=e29]:
          - radio "Cruiser C3, down" [disabled] [ref=e30]
          - generic [ref=e31]: Cruiser
          - generic [ref=e32]: C3, down
        - generic [ref=e33]:
          - radio "Submarine E3, down" [disabled] [ref=e34]
          - generic [ref=e35]: Submarine
          - generic [ref=e36]: E3, down
        - generic [ref=e37]:
          - radio "Destroyer G3, down" [disabled] [ref=e38]
          - generic [ref=e39]: Destroyer
          - generic [ref=e40]: G3, down
    - generic [ref=e41]:
      - button "Enlarge placement" [disabled] [ref=e42]:
        - paragraph [ref=e45]: Enlarge placement
      - generic [ref=e46]:
        - generic [ref=e47]:
          - button "Rotate down" [disabled] [ref=e48]:
            - paragraph [ref=e51]: Rotate down
          - button "Remove" [disabled] [ref=e52]:
            - paragraph [ref=e55]: Remove
        - paragraph [ref=e56]: Choose a placed ship to move or remove it.
        - group "Your waters" [ref=e57]:
          - generic [ref=e59]: A
          - generic [ref=e60]: B
          - generic [ref=e61]: C
          - generic [ref=e62]: D
          - generic [ref=e63]: E
          - generic [ref=e64]: F
          - generic [ref=e65]: G
          - generic [ref=e66]: H
          - generic [ref=e67]: I
          - generic [ref=e68]: J
          - generic [ref=e69]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e70]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e71]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e72]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e73]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e74]':
            - generic: ■
          - 'button "F1: open water" [disabled] [ref=e75]'
          - 'button "G1: open water" [disabled] [ref=e76]'
          - 'button "H1: open water" [disabled] [ref=e77]'
          - 'button "I1: open water" [disabled] [ref=e78]'
          - 'button "J1: open water" [disabled] [ref=e79]'
          - generic [ref=e80]: "2"
          - 'button "A2: open water" [disabled] [ref=e81]'
          - 'button "B2: open water" [disabled] [ref=e82]'
          - 'button "C2: open water" [disabled] [ref=e83]'
          - 'button "D2: open water" [disabled] [ref=e84]'
          - 'button "E2: open water" [disabled] [ref=e85]'
          - 'button "F2: open water" [disabled] [ref=e86]'
          - 'button "G2: open water" [disabled] [ref=e87]'
          - 'button "H2: open water" [disabled] [ref=e88]'
          - 'button "I2: open water" [disabled] [ref=e89]'
          - 'button "J2: open water" [disabled] [ref=e90]'
          - generic [ref=e91]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e92]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e93]'
          - 'button "C3: Cruiser" [disabled] [ref=e94]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e95]'
          - 'button "E3: Submarine" [disabled] [ref=e96]':
            - generic: ■
          - 'button "F3: open water" [disabled] [ref=e97]'
          - 'button "G3: Destroyer" [disabled] [ref=e98]':
            - generic: ■
          - 'button "H3: open water" [disabled] [ref=e99]'
          - 'button "I3: open water" [disabled] [ref=e100]'
          - 'button "J3: open water" [disabled] [ref=e101]'
          - generic [ref=e102]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e103]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e104]'
          - 'button "C4: Cruiser" [disabled] [ref=e105]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e106]'
          - 'button "E4: Submarine" [disabled] [ref=e107]':
            - generic: ■
          - 'button "F4: open water" [disabled] [ref=e108]'
          - 'button "G4: Destroyer" [disabled] [ref=e109]':
            - generic: ■
          - 'button "H4: open water" [disabled] [ref=e110]'
          - 'button "I4: open water" [disabled] [ref=e111]'
          - 'button "J4: open water" [disabled] [ref=e112]'
          - generic [ref=e113]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e114]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e115]'
          - 'button "C5: Cruiser" [disabled] [ref=e116]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e117]'
          - 'button "E5: Submarine" [disabled] [ref=e118]':
            - generic: ■
          - 'button "F5: open water" [disabled] [ref=e119]'
          - 'button "G5: open water" [disabled] [ref=e120]'
          - 'button "H5: open water" [disabled] [ref=e121]'
          - 'button "I5: open water" [disabled] [ref=e122]'
          - 'button "J5: open water" [disabled] [ref=e123]'
          - generic [ref=e124]: "6"
          - 'button "A6: Battleship" [disabled] [ref=e125]':
            - generic: ■
          - 'button "B6: open water" [disabled] [ref=e126]'
          - 'button "C6: open water" [disabled] [ref=e127]'
          - 'button "D6: open water" [disabled] [ref=e128]'
          - 'button "E6: open water" [disabled] [ref=e129]'
          - 'button "F6: open water" [disabled] [ref=e130]'
          - 'button "G6: open water" [disabled] [ref=e131]'
          - 'button "H6: open water" [disabled] [ref=e132]'
          - 'button "I6: open water" [disabled] [ref=e133]'
          - 'button "J6: open water" [disabled] [ref=e134]'
          - generic [ref=e135]: "7"
          - 'button "A7: open water" [disabled] [ref=e136]'
          - 'button "B7: open water" [disabled] [ref=e137]'
          - 'button "C7: open water" [disabled] [ref=e138]'
          - 'button "D7: open water" [disabled] [ref=e139]'
          - 'button "E7: open water" [disabled] [ref=e140]'
          - 'button "F7: open water" [disabled] [ref=e141]'
          - 'button "G7: open water" [disabled] [ref=e142]'
          - 'button "H7: open water" [disabled] [ref=e143]'
          - 'button "I7: open water" [disabled] [ref=e144]'
          - 'button "J7: open water" [disabled] [ref=e145]'
          - generic [ref=e146]: "8"
          - 'button "A8: open water" [disabled] [ref=e147]'
          - 'button "B8: open water" [disabled] [ref=e148]'
          - 'button "C8: open water" [disabled] [ref=e149]'
          - 'button "D8: open water" [disabled] [ref=e150]'
          - 'button "E8: open water" [disabled] [ref=e151]'
          - 'button "F8: open water" [disabled] [ref=e152]'
          - 'button "G8: open water" [disabled] [ref=e153]'
          - 'button "H8: open water" [disabled] [ref=e154]'
          - 'button "I8: open water" [disabled] [ref=e155]'
          - 'button "J8: open water" [disabled] [ref=e156]'
          - generic [ref=e157]: "9"
          - 'button "A9: open water" [disabled] [ref=e158]'
          - 'button "B9: open water" [disabled] [ref=e159]'
          - 'button "C9: open water" [disabled] [ref=e160]'
          - 'button "D9: open water" [disabled] [ref=e161]'
          - 'button "E9: open water" [disabled] [ref=e162]'
          - 'button "F9: open water" [disabled] [ref=e163]'
          - 'button "G9: open water" [disabled] [ref=e164]'
          - 'button "H9: open water" [disabled] [ref=e165]'
          - 'button "I9: open water" [disabled] [ref=e166]'
          - 'button "J9: open water" [disabled] [ref=e167]'
          - generic [ref=e168]: "10"
          - 'button "A10: open water" [disabled] [ref=e169]'
          - 'button "B10: open water" [disabled] [ref=e170]'
          - 'button "C10: open water" [disabled] [ref=e171]'
          - 'button "D10: open water" [disabled] [ref=e172]'
          - 'button "E10: open water" [disabled] [ref=e173]'
          - 'button "F10: open water" [disabled] [ref=e174]'
          - 'button "G10: open water" [disabled] [ref=e175]'
          - 'button "H10: open water" [disabled] [ref=e176]'
          - 'button "I10: open water" [disabled] [ref=e177]'
          - 'button "J10: open water" [disabled] [ref=e178]'
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