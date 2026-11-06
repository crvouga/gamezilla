# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--enlarged-placement light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  46361 pixels (ratio 0.15 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 46361 pixels (ratio 0.15 of all image pixels) are different.
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
  - 46361 pixels (ratio 0.15 of all image pixels) are different.

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
      - button "Close enlarged placement" [ref=e22] [cursor=pointer]:
        - paragraph [ref=e25]: Close enlarged placement
      - generic [ref=e26]:
        - generic [ref=e27]:
          - generic [ref=e28]:
            - paragraph [ref=e29]: Ship
            - button "Ship to place" [ref=e30] [cursor=pointer]:
              - paragraph [ref=e31]: Choose a ship to reposition
              - img [ref=e33]
          - generic [ref=e35]:
            - paragraph [ref=e36]: Region
            - button "Placement area" [ref=e37] [cursor=pointer]:
              - paragraph [ref=e38]: F–J / 6–10
              - img [ref=e40]
          - group "Enlarged bow placement" [ref=e42]:
            - generic [ref=e44]: F
            - generic [ref=e45]: G
            - generic [ref=e46]: H
            - generic [ref=e47]: I
            - generic [ref=e48]: J
            - generic [ref=e49]: "6"
            - 'button "F6: open water" [disabled] [ref=e50]'
            - 'button "G6: open water" [disabled] [ref=e51]'
            - 'button "H6: open water" [disabled] [ref=e52]'
            - 'button "I6: open water" [disabled] [ref=e53]'
            - 'button "J6: open water" [disabled] [ref=e54]'
            - generic [ref=e55]: "7"
            - 'button "F7: open water" [disabled] [ref=e56]'
            - 'button "G7: open water" [disabled] [ref=e57]'
            - 'button "H7: open water" [disabled] [ref=e58]'
            - 'button "I7: Destroyer" [disabled] [active] [ref=e59]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e60]':
              - generic: ■
            - generic [ref=e61]: "8"
            - 'button "F8: open water" [disabled] [ref=e62]'
            - 'button "G8: open water" [disabled] [ref=e63]'
            - 'button "H8: open water" [disabled] [ref=e64]'
            - 'button "I8: open water" [disabled] [ref=e65]'
            - 'button "J8: open water" [disabled] [ref=e66]'
            - generic [ref=e67]: "9"
            - 'button "F9: open water" [disabled] [ref=e68]'
            - 'button "G9: open water" [disabled] [ref=e69]'
            - 'button "H9: open water" [disabled] [ref=e70]'
            - 'button "I9: open water" [disabled] [ref=e71]'
            - 'button "J9: open water" [disabled] [ref=e72]'
            - generic [ref=e73]: "10"
            - 'button "F10: open water" [disabled] [ref=e74]'
            - 'button "G10: open water" [disabled] [ref=e75]'
            - 'button "H10: open water" [disabled] [ref=e76]'
            - 'button "I10: open water" [disabled] [ref=e77]'
            - 'button "J10: open water" [disabled] [ref=e78]'
        - generic [ref=e79]:
          - generic [ref=e80]: Fleet overview
          - group "Your waters" [ref=e82]:
            - generic [ref=e84]: A
            - generic [ref=e85]: B
            - generic [ref=e86]: C
            - generic [ref=e87]: D
            - generic [ref=e88]: E
            - generic [ref=e89]: F
            - generic [ref=e90]: G
            - generic [ref=e91]: H
            - generic [ref=e92]: I
            - generic [ref=e93]: J
            - generic [ref=e94]: "1"
            - 'button "A1: Carrier" [disabled] [ref=e95]':
              - generic: ■
            - 'button "B1: Carrier" [disabled] [ref=e96]':
              - generic: ■
            - 'button "C1: Carrier" [disabled] [ref=e97]':
              - generic: ■
            - 'button "D1: Carrier" [disabled] [ref=e98]':
              - generic: ■
            - 'button "E1: Carrier" [disabled] [ref=e99]':
              - generic: ■
            - 'button "F1: open water" [disabled] [ref=e100]'
            - 'button "G1: open water" [disabled] [ref=e101]'
            - 'button "H1: open water" [disabled] [ref=e102]'
            - 'button "I1: open water" [disabled] [ref=e103]'
            - 'button "J1: open water" [disabled] [ref=e104]'
            - generic [ref=e105]: "2"
            - 'button "A2: open water" [disabled] [ref=e106]'
            - 'button "B2: open water" [disabled] [ref=e107]'
            - 'button "C2: open water" [disabled] [ref=e108]'
            - 'button "D2: open water" [disabled] [ref=e109]'
            - 'button "E2: open water" [disabled] [ref=e110]'
            - 'button "F2: open water" [disabled] [ref=e111]'
            - 'button "G2: open water" [disabled] [ref=e112]'
            - 'button "H2: open water" [disabled] [ref=e113]'
            - 'button "I2: open water" [disabled] [ref=e114]'
            - 'button "J2: open water" [disabled] [ref=e115]'
            - generic [ref=e116]: "3"
            - 'button "A3: Battleship" [disabled] [ref=e117]':
              - generic: ■
            - 'button "B3: open water" [disabled] [ref=e118]'
            - 'button "C3: Cruiser" [disabled] [ref=e119]':
              - generic: ■
            - 'button "D3: open water" [disabled] [ref=e120]'
            - 'button "E3: Submarine" [disabled] [ref=e121]':
              - generic: ■
            - 'button "F3: open water" [disabled] [ref=e122]'
            - 'button "G3: open water" [disabled] [ref=e123]'
            - 'button "H3: open water" [disabled] [ref=e124]'
            - 'button "I3: open water" [disabled] [ref=e125]'
            - 'button "J3: open water" [disabled] [ref=e126]'
            - generic [ref=e127]: "4"
            - 'button "A4: Battleship" [disabled] [ref=e128]':
              - generic: ■
            - 'button "B4: open water" [disabled] [ref=e129]'
            - 'button "C4: Cruiser" [disabled] [ref=e130]':
              - generic: ■
            - 'button "D4: open water" [disabled] [ref=e131]'
            - 'button "E4: Submarine" [disabled] [ref=e132]':
              - generic: ■
            - 'button "F4: open water" [disabled] [ref=e133]'
            - 'button "G4: open water" [disabled] [ref=e134]'
            - 'button "H4: open water" [disabled] [ref=e135]'
            - 'button "I4: open water" [disabled] [ref=e136]'
            - 'button "J4: open water" [disabled] [ref=e137]'
            - generic [ref=e138]: "5"
            - 'button "A5: Battleship" [disabled] [ref=e139]':
              - generic: ■
            - 'button "B5: open water" [disabled] [ref=e140]'
            - 'button "C5: Cruiser" [disabled] [ref=e141]':
              - generic: ■
            - 'button "D5: open water" [disabled] [ref=e142]'
            - 'button "E5: Submarine" [disabled] [ref=e143]':
              - generic: ■
            - 'button "F5: open water" [disabled] [ref=e144]'
            - 'button "G5: open water" [disabled] [ref=e145]'
            - 'button "H5: open water" [disabled] [ref=e146]'
            - 'button "I5: open water" [disabled] [ref=e147]'
            - 'button "J5: open water" [disabled] [ref=e148]'
            - generic [ref=e149]: "6"
            - 'button "A6: Battleship" [disabled] [ref=e150]':
              - generic: ■
            - 'button "B6: open water" [disabled] [ref=e151]'
            - 'button "C6: open water" [disabled] [ref=e152]'
            - 'button "D6: open water" [disabled] [ref=e153]'
            - 'button "E6: open water" [disabled] [ref=e154]'
            - 'button "F6: open water" [disabled] [ref=e155]'
            - 'button "G6: open water" [disabled] [ref=e156]'
            - 'button "H6: open water" [disabled] [ref=e157]'
            - 'button "I6: open water" [disabled] [ref=e158]'
            - 'button "J6: open water" [disabled] [ref=e159]'
            - generic [ref=e160]: "7"
            - 'button "A7: open water" [disabled] [ref=e161]'
            - 'button "B7: open water" [disabled] [ref=e162]'
            - 'button "C7: open water" [disabled] [ref=e163]'
            - 'button "D7: open water" [disabled] [ref=e164]'
            - 'button "E7: open water" [disabled] [ref=e165]'
            - 'button "F7: open water" [disabled] [ref=e166]'
            - 'button "G7: open water" [disabled] [ref=e167]'
            - 'button "H7: open water" [disabled] [ref=e168]'
            - 'button "I7: Destroyer" [disabled] [ref=e169]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e170]':
              - generic: ■
            - generic [ref=e171]: "8"
            - 'button "A8: open water" [disabled] [ref=e172]'
            - 'button "B8: open water" [disabled] [ref=e173]'
            - 'button "C8: open water" [disabled] [ref=e174]'
            - 'button "D8: open water" [disabled] [ref=e175]'
            - 'button "E8: open water" [disabled] [ref=e176]'
            - 'button "F8: open water" [disabled] [ref=e177]'
            - 'button "G8: open water" [disabled] [ref=e178]'
            - 'button "H8: open water" [disabled] [ref=e179]'
            - 'button "I8: open water" [disabled] [ref=e180]'
            - 'button "J8: open water" [disabled] [ref=e181]'
            - generic [ref=e182]: "9"
            - 'button "A9: open water" [disabled] [ref=e183]'
            - 'button "B9: open water" [disabled] [ref=e184]'
            - 'button "C9: open water" [disabled] [ref=e185]'
            - 'button "D9: open water" [disabled] [ref=e186]'
            - 'button "E9: open water" [disabled] [ref=e187]'
            - 'button "F9: open water" [disabled] [ref=e188]'
            - 'button "G9: open water" [disabled] [ref=e189]'
            - 'button "H9: open water" [disabled] [ref=e190]'
            - 'button "I9: open water" [disabled] [ref=e191]'
            - 'button "J9: open water" [disabled] [ref=e192]'
            - generic [ref=e193]: "10"
            - 'button "A10: open water" [disabled] [ref=e194]'
            - 'button "B10: open water" [disabled] [ref=e195]'
            - 'button "C10: open water" [disabled] [ref=e196]'
            - 'button "D10: open water" [disabled] [ref=e197]'
            - 'button "E10: open water" [disabled] [ref=e198]'
            - 'button "F10: open water" [disabled] [ref=e199]'
            - 'button "G10: open water" [disabled] [ref=e200]'
            - 'button "H10: open water" [disabled] [ref=e201]'
            - 'button "I10: open water" [disabled] [ref=e202]'
            - 'button "J10: open water" [disabled] [ref=e203]'
    - paragraph [ref=e204]: Choose a placed ship to move or remove it.
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