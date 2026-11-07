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
  42407 pixels (ratio 0.13 of all image pixels) are different.

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
  - 42407 pixels (ratio 0.13 of all image pixels) are different.
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
  - 42407 pixels (ratio 0.13 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - group "Ships" [ref=e12]:
      - generic [ref=e13]: Ships
      - generic [ref=e14]:
        - generic [ref=e15] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e16]
          - generic [ref=e17]: Carrier
          - generic [ref=e18]: A1, across
        - generic [ref=e19] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e20]
          - generic [ref=e21]: Battleship
          - generic [ref=e22]: A3, down
        - generic [ref=e23] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e24]
          - generic [ref=e25]: Cruiser
          - generic [ref=e26]: C3, down
        - generic [ref=e27] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e28]
          - generic [ref=e29]: Submarine
          - generic [ref=e30]: E3, down
        - generic [ref=e31] [cursor=pointer]:
          - radio "Destroyer G3, down" [ref=e32]
          - generic [ref=e33]: Destroyer
          - generic [ref=e34]: G3, down
    - generic [ref=e35]:
      - button "Enlarge placement" [ref=e36] [cursor=pointer]:
        - paragraph [ref=e39]: Enlarge placement
      - generic [ref=e40]:
        - generic [ref=e41]:
          - button "Rotate down" [disabled] [ref=e42]:
            - paragraph [ref=e45]: Rotate down
          - button "Remove" [disabled] [ref=e46]:
            - paragraph [ref=e49]: Remove
        - paragraph [ref=e50]: Choose a placed ship to move or remove it.
        - group "Your waters" [ref=e51]:
          - generic [ref=e53]: A
          - generic [ref=e54]: B
          - generic [ref=e55]: C
          - generic [ref=e56]: D
          - generic [ref=e57]: E
          - generic [ref=e58]: F
          - generic [ref=e59]: G
          - generic [ref=e60]: H
          - generic [ref=e61]: I
          - generic [ref=e62]: J
          - generic [ref=e63]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e64]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e65]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e66]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e67]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e68]':
            - generic: ■
          - 'button "F1: open water" [disabled] [ref=e69]'
          - 'button "G1: open water" [disabled] [ref=e70]'
          - 'button "H1: open water" [disabled] [ref=e71]'
          - 'button "I1: open water" [disabled] [ref=e72]'
          - 'button "J1: open water" [disabled] [ref=e73]'
          - generic [ref=e74]: "2"
          - 'button "A2: open water" [disabled] [ref=e75]'
          - 'button "B2: open water" [disabled] [ref=e76]'
          - 'button "C2: open water" [disabled] [ref=e77]'
          - 'button "D2: open water" [disabled] [ref=e78]'
          - 'button "E2: open water" [disabled] [ref=e79]'
          - 'button "F2: open water" [disabled] [ref=e80]'
          - 'button "G2: open water" [disabled] [ref=e81]'
          - 'button "H2: open water" [disabled] [ref=e82]'
          - 'button "I2: open water" [disabled] [ref=e83]'
          - 'button "J2: open water" [disabled] [ref=e84]'
          - generic [ref=e85]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e86]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e87]'
          - 'button "C3: Cruiser" [disabled] [ref=e88]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e89]'
          - 'button "E3: Submarine" [disabled] [ref=e90]':
            - generic: ■
          - 'button "F3: open water" [disabled] [ref=e91]'
          - 'button "G3: Destroyer" [disabled] [ref=e92]':
            - generic: ■
          - 'button "H3: open water" [disabled] [ref=e93]'
          - 'button "I3: open water" [disabled] [ref=e94]'
          - 'button "J3: open water" [disabled] [ref=e95]'
          - generic [ref=e96]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e97]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e98]'
          - 'button "C4: Cruiser" [disabled] [ref=e99]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e100]'
          - 'button "E4: Submarine" [disabled] [ref=e101]':
            - generic: ■
          - 'button "F4: open water" [disabled] [ref=e102]'
          - 'button "G4: Destroyer" [disabled] [ref=e103]':
            - generic: ■
          - 'button "H4: open water" [disabled] [ref=e104]'
          - 'button "I4: open water" [disabled] [ref=e105]'
          - 'button "J4: open water" [disabled] [ref=e106]'
          - generic [ref=e107]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e108]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e109]'
          - 'button "C5: Cruiser" [disabled] [ref=e110]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e111]'
          - 'button "E5: Submarine" [disabled] [ref=e112]':
            - generic: ■
          - 'button "F5: open water" [disabled] [ref=e113]'
          - 'button "G5: open water" [disabled] [ref=e114]'
          - 'button "H5: open water" [disabled] [ref=e115]'
          - 'button "I5: open water" [disabled] [ref=e116]'
          - 'button "J5: open water" [disabled] [ref=e117]'
          - generic [ref=e118]: "6"
          - 'button "A6: Battleship" [disabled] [ref=e119]':
            - generic: ■
          - 'button "B6: open water" [disabled] [ref=e120]'
          - 'button "C6: open water" [disabled] [ref=e121]'
          - 'button "D6: open water" [disabled] [ref=e122]'
          - 'button "E6: open water" [disabled] [ref=e123]'
          - 'button "F6: open water" [disabled] [ref=e124]'
          - 'button "G6: open water" [disabled] [ref=e125]'
          - 'button "H6: open water" [disabled] [ref=e126]'
          - 'button "I6: open water" [disabled] [ref=e127]'
          - 'button "J6: open water" [disabled] [ref=e128]'
          - generic [ref=e129]: "7"
          - 'button "A7: open water" [disabled] [ref=e130]'
          - 'button "B7: open water" [disabled] [ref=e131]'
          - 'button "C7: open water" [disabled] [ref=e132]'
          - 'button "D7: open water" [disabled] [ref=e133]'
          - 'button "E7: open water" [disabled] [ref=e134]'
          - 'button "F7: open water" [disabled] [ref=e135]'
          - 'button "G7: open water" [disabled] [ref=e136]'
          - 'button "H7: open water" [disabled] [ref=e137]'
          - 'button "I7: open water" [disabled] [ref=e138]'
          - 'button "J7: open water" [disabled] [ref=e139]'
          - generic [ref=e140]: "8"
          - 'button "A8: open water" [disabled] [ref=e141]'
          - 'button "B8: open water" [disabled] [ref=e142]'
          - 'button "C8: open water" [disabled] [ref=e143]'
          - 'button "D8: open water" [disabled] [ref=e144]'
          - 'button "E8: open water" [disabled] [ref=e145]'
          - 'button "F8: open water" [disabled] [ref=e146]'
          - 'button "G8: open water" [disabled] [ref=e147]'
          - 'button "H8: open water" [disabled] [ref=e148]'
          - 'button "I8: open water" [disabled] [ref=e149]'
          - 'button "J8: open water" [disabled] [ref=e150]'
          - generic [ref=e151]: "9"
          - 'button "A9: open water" [disabled] [ref=e152]'
          - 'button "B9: open water" [disabled] [ref=e153]'
          - 'button "C9: open water" [disabled] [ref=e154]'
          - 'button "D9: open water" [disabled] [ref=e155]'
          - 'button "E9: open water" [disabled] [ref=e156]'
          - 'button "F9: open water" [disabled] [ref=e157]'
          - 'button "G9: open water" [disabled] [ref=e158]'
          - 'button "H9: open water" [disabled] [ref=e159]'
          - 'button "I9: open water" [disabled] [ref=e160]'
          - 'button "J9: open water" [disabled] [ref=e161]'
          - generic [ref=e162]: "10"
          - 'button "A10: open water" [disabled] [ref=e163]'
          - 'button "B10: open water" [disabled] [ref=e164]'
          - 'button "C10: open water" [disabled] [ref=e165]'
          - 'button "D10: open water" [disabled] [ref=e166]'
          - 'button "E10: open water" [disabled] [ref=e167]'
          - 'button "F10: open water" [disabled] [ref=e168]'
          - 'button "G10: open water" [disabled] [ref=e169]'
          - 'button "H10: open water" [disabled] [ref=e170]'
          - 'button "I10: open water" [disabled] [ref=e171]'
          - 'button "J10: open water" [disabled] [ref=e172]'
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