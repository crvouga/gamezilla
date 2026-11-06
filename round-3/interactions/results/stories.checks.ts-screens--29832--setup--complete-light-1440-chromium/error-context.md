# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--complete light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  89080 pixels (ratio 0.08 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/complete-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/complete-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 89080 pixels (ratio 0.08 of all image pixels) are different.
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
  - 89080 pixels (ratio 0.08 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: All five ships placed. Your fleet is ready.
    - generic [ref=e15]:
      - button "Rotate down" [disabled] [ref=e16]:
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
      - 'button "A1: Carrier" [disabled] [ref=e42]':
        - generic: ■
      - 'button "B1: Carrier" [disabled] [ref=e43]':
        - generic: ■
      - 'button "C1: Carrier" [disabled] [ref=e44]':
        - generic: ■
      - 'button "D1: Carrier" [disabled] [ref=e45]':
        - generic: ■
      - 'button "E1: Carrier" [disabled] [ref=e46]':
        - generic: ■
      - 'button "F1: open water" [disabled] [ref=e47]'
      - 'button "G1: open water" [disabled] [ref=e48]'
      - 'button "H1: open water" [disabled] [ref=e49]'
      - 'button "I1: open water" [disabled] [ref=e50]'
      - 'button "J1: open water" [disabled] [ref=e51]'
      - generic [ref=e52]: "2"
      - 'button "A2: open water" [disabled] [ref=e53]'
      - 'button "B2: open water" [disabled] [ref=e54]'
      - 'button "C2: open water" [disabled] [ref=e55]'
      - 'button "D2: open water" [disabled] [ref=e56]'
      - 'button "E2: open water" [disabled] [ref=e57]'
      - 'button "F2: open water" [disabled] [ref=e58]'
      - 'button "G2: open water" [disabled] [ref=e59]'
      - 'button "H2: open water" [disabled] [ref=e60]'
      - 'button "I2: open water" [disabled] [ref=e61]'
      - 'button "J2: open water" [disabled] [ref=e62]'
      - generic [ref=e63]: "3"
      - 'button "A3: Battleship" [disabled] [ref=e64]':
        - generic: ■
      - 'button "B3: open water" [disabled] [ref=e65]'
      - 'button "C3: Cruiser" [disabled] [ref=e66]':
        - generic: ■
      - 'button "D3: open water" [disabled] [ref=e67]'
      - 'button "E3: Submarine" [disabled] [ref=e68]':
        - generic: ■
      - 'button "F3: open water" [disabled] [ref=e69]'
      - 'button "G3: Destroyer" [disabled] [ref=e70]':
        - generic: ■
      - 'button "H3: open water" [disabled] [ref=e71]'
      - 'button "I3: open water" [disabled] [ref=e72]'
      - 'button "J3: open water" [disabled] [ref=e73]'
      - generic [ref=e74]: "4"
      - 'button "A4: Battleship" [disabled] [ref=e75]':
        - generic: ■
      - 'button "B4: open water" [disabled] [ref=e76]'
      - 'button "C4: Cruiser" [disabled] [ref=e77]':
        - generic: ■
      - 'button "D4: open water" [disabled] [ref=e78]'
      - 'button "E4: Submarine" [disabled] [ref=e79]':
        - generic: ■
      - 'button "F4: open water" [disabled] [ref=e80]'
      - 'button "G4: Destroyer" [disabled] [ref=e81]':
        - generic: ■
      - 'button "H4: open water" [disabled] [ref=e82]'
      - 'button "I4: open water" [disabled] [ref=e83]'
      - 'button "J4: open water" [disabled] [ref=e84]'
      - generic [ref=e85]: "5"
      - 'button "A5: Battleship" [disabled] [ref=e86]':
        - generic: ■
      - 'button "B5: open water" [disabled] [ref=e87]'
      - 'button "C5: Cruiser" [disabled] [ref=e88]':
        - generic: ■
      - 'button "D5: open water" [disabled] [ref=e89]'
      - 'button "E5: Submarine" [disabled] [ref=e90]':
        - generic: ■
      - 'button "F5: open water" [disabled] [ref=e91]'
      - 'button "G5: open water" [disabled] [ref=e92]'
      - 'button "H5: open water" [disabled] [ref=e93]'
      - 'button "I5: open water" [disabled] [ref=e94]'
      - 'button "J5: open water" [disabled] [ref=e95]'
      - generic [ref=e96]: "6"
      - 'button "A6: Battleship" [disabled] [ref=e97]':
        - generic: ■
      - 'button "B6: open water" [disabled] [ref=e98]'
      - 'button "C6: open water" [disabled] [ref=e99]'
      - 'button "D6: open water" [disabled] [ref=e100]'
      - 'button "E6: open water" [disabled] [ref=e101]'
      - 'button "F6: open water" [disabled] [ref=e102]'
      - 'button "G6: open water" [disabled] [ref=e103]'
      - 'button "H6: open water" [disabled] [ref=e104]'
      - 'button "I6: open water" [disabled] [ref=e105]'
      - 'button "J6: open water" [disabled] [ref=e106]'
      - generic [ref=e107]: "7"
      - 'button "A7: open water" [disabled] [ref=e108]'
      - 'button "B7: open water" [disabled] [ref=e109]'
      - 'button "C7: open water" [disabled] [ref=e110]'
      - 'button "D7: open water" [disabled] [ref=e111]'
      - 'button "E7: open water" [disabled] [ref=e112]'
      - 'button "F7: open water" [disabled] [ref=e113]'
      - 'button "G7: open water" [disabled] [ref=e114]'
      - 'button "H7: open water" [disabled] [ref=e115]'
      - 'button "I7: open water" [disabled] [ref=e116]'
      - 'button "J7: open water" [disabled] [ref=e117]'
      - generic [ref=e118]: "8"
      - 'button "A8: open water" [disabled] [ref=e119]'
      - 'button "B8: open water" [disabled] [ref=e120]'
      - 'button "C8: open water" [disabled] [ref=e121]'
      - 'button "D8: open water" [disabled] [ref=e122]'
      - 'button "E8: open water" [disabled] [ref=e123]'
      - 'button "F8: open water" [disabled] [ref=e124]'
      - 'button "G8: open water" [disabled] [ref=e125]'
      - 'button "H8: open water" [disabled] [ref=e126]'
      - 'button "I8: open water" [disabled] [ref=e127]'
      - 'button "J8: open water" [disabled] [ref=e128]'
      - generic [ref=e129]: "9"
      - 'button "A9: open water" [disabled] [ref=e130]'
      - 'button "B9: open water" [disabled] [ref=e131]'
      - 'button "C9: open water" [disabled] [ref=e132]'
      - 'button "D9: open water" [disabled] [ref=e133]'
      - 'button "E9: open water" [disabled] [ref=e134]'
      - 'button "F9: open water" [disabled] [ref=e135]'
      - 'button "G9: open water" [disabled] [ref=e136]'
      - 'button "H9: open water" [disabled] [ref=e137]'
      - 'button "I9: open water" [disabled] [ref=e138]'
      - 'button "J9: open water" [disabled] [ref=e139]'
      - generic [ref=e140]: "10"
      - 'button "A10: open water" [disabled] [ref=e141]'
      - 'button "B10: open water" [disabled] [ref=e142]'
      - 'button "C10: open water" [disabled] [ref=e143]'
      - 'button "D10: open water" [disabled] [ref=e144]'
      - 'button "E10: open water" [disabled] [ref=e145]'
      - 'button "F10: open water" [disabled] [ref=e146]'
      - 'button "G10: open water" [disabled] [ref=e147]'
      - 'button "H10: open water" [disabled] [ref=e148]'
      - 'button "I10: open water" [disabled] [ref=e149]'
      - 'button "J10: open water" [disabled] [ref=e150]'
    - group "Ships" [ref=e151]:
      - generic [ref=e152]: Ships
      - generic [ref=e153]:
        - generic [ref=e154] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e155]
          - generic [ref=e156]: Carrier
          - generic [ref=e157]: A1, across
        - generic [ref=e158] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e159]
          - generic [ref=e160]: Battleship
          - generic [ref=e161]: A3, down
        - generic [ref=e162] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e163]
          - generic [ref=e164]: Cruiser
          - generic [ref=e165]: C3, down
        - generic [ref=e166] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e167]
          - generic [ref=e168]: Submarine
          - generic [ref=e169]: E3, down
        - generic [ref=e170] [cursor=pointer]:
          - radio "Destroyer G3, down" [ref=e171]
          - generic [ref=e172]: Destroyer
          - generic [ref=e173]: G3, down
    - paragraph [ref=e174]: Choose a placed ship to move or remove it.
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