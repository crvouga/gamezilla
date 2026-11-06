# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--enlarged-placement light-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  73765 pixels (ratio 0.07 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-light-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 73765 pixels (ratio 0.07 of all image pixels) are different.
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
  - 73765 pixels (ratio 0.07 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e13]:
    - status [ref=e14]: All five ships placed. Your fleet is ready.
    - generic [ref=e15]:
      - button "Close enlarged placement" [ref=e16] [cursor=pointer]:
        - paragraph [ref=e19]: Close enlarged placement
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]:
            - paragraph [ref=e23]: Ship
            - button "Ship to place" [ref=e24] [cursor=pointer]:
              - paragraph [ref=e25]: Choose a ship to reposition
              - img [ref=e27]
          - generic [ref=e29]:
            - button "Rotate down" [disabled] [ref=e30]:
              - paragraph [ref=e33]: Rotate down
            - button "Remove" [disabled] [ref=e34]:
              - paragraph [ref=e37]: Remove
          - generic [ref=e38]:
            - paragraph [ref=e39]: Region
            - button "Placement area" [ref=e40] [cursor=pointer]:
              - paragraph [ref=e41]: F–J / 6–10
              - img [ref=e43]
        - paragraph [ref=e46]: Choose a placed ship to move or remove it.
        - group "Enlarged bow placement" [ref=e48]:
          - generic [ref=e50]: F
          - generic [ref=e51]: G
          - generic [ref=e52]: H
          - generic [ref=e53]: I
          - generic [ref=e54]: J
          - generic [ref=e55]: "6"
          - 'button "F6: open water" [disabled] [ref=e56]'
          - 'button "G6: open water" [disabled] [ref=e57]'
          - 'button "H6: open water" [disabled] [ref=e58]'
          - 'button "I6: open water" [disabled] [ref=e59]'
          - 'button "J6: open water" [disabled] [ref=e60]'
          - generic [ref=e61]: "7"
          - 'button "F7: open water" [disabled] [ref=e62]'
          - 'button "G7: open water" [disabled] [ref=e63]'
          - 'button "H7: open water" [disabled] [ref=e64]'
          - 'button "I7: Destroyer" [disabled] [active] [ref=e65]':
            - generic: ■
          - 'button "J7: Destroyer" [disabled] [ref=e66]':
            - generic: ■
          - generic [ref=e67]: "8"
          - 'button "F8: open water" [disabled] [ref=e68]'
          - 'button "G8: open water" [disabled] [ref=e69]'
          - 'button "H8: open water" [disabled] [ref=e70]'
          - 'button "I8: open water" [disabled] [ref=e71]'
          - 'button "J8: open water" [disabled] [ref=e72]'
          - generic [ref=e73]: "9"
          - 'button "F9: open water" [disabled] [ref=e74]'
          - 'button "G9: open water" [disabled] [ref=e75]'
          - 'button "H9: open water" [disabled] [ref=e76]'
          - 'button "I9: open water" [disabled] [ref=e77]'
          - 'button "J9: open water" [disabled] [ref=e78]'
          - generic [ref=e79]: "10"
          - 'button "F10: open water" [disabled] [ref=e80]'
          - 'button "G10: open water" [disabled] [ref=e81]'
          - 'button "H10: open water" [disabled] [ref=e82]'
          - 'button "I10: open water" [disabled] [ref=e83]'
          - 'button "J10: open water" [disabled] [ref=e84]'
        - generic [ref=e85]:
          - generic [ref=e86]: Fleet overview
          - group "Your waters" [ref=e88]:
            - generic [ref=e90]: A
            - generic [ref=e91]: B
            - generic [ref=e92]: C
            - generic [ref=e93]: D
            - generic [ref=e94]: E
            - generic [ref=e95]: F
            - generic [ref=e96]: G
            - generic [ref=e97]: H
            - generic [ref=e98]: I
            - generic [ref=e99]: J
            - generic [ref=e100]: "1"
            - 'button "A1: Carrier" [disabled] [ref=e101]':
              - generic: ■
            - 'button "B1: Carrier" [disabled] [ref=e102]':
              - generic: ■
            - 'button "C1: Carrier" [disabled] [ref=e103]':
              - generic: ■
            - 'button "D1: Carrier" [disabled] [ref=e104]':
              - generic: ■
            - 'button "E1: Carrier" [disabled] [ref=e105]':
              - generic: ■
            - 'button "F1: open water" [disabled] [ref=e106]'
            - 'button "G1: open water" [disabled] [ref=e107]'
            - 'button "H1: open water" [disabled] [ref=e108]'
            - 'button "I1: open water" [disabled] [ref=e109]'
            - 'button "J1: open water" [disabled] [ref=e110]'
            - generic [ref=e111]: "2"
            - 'button "A2: open water" [disabled] [ref=e112]'
            - 'button "B2: open water" [disabled] [ref=e113]'
            - 'button "C2: open water" [disabled] [ref=e114]'
            - 'button "D2: open water" [disabled] [ref=e115]'
            - 'button "E2: open water" [disabled] [ref=e116]'
            - 'button "F2: open water" [disabled] [ref=e117]'
            - 'button "G2: open water" [disabled] [ref=e118]'
            - 'button "H2: open water" [disabled] [ref=e119]'
            - 'button "I2: open water" [disabled] [ref=e120]'
            - 'button "J2: open water" [disabled] [ref=e121]'
            - generic [ref=e122]: "3"
            - 'button "A3: Battleship" [disabled] [ref=e123]':
              - generic: ■
            - 'button "B3: open water" [disabled] [ref=e124]'
            - 'button "C3: Cruiser" [disabled] [ref=e125]':
              - generic: ■
            - 'button "D3: open water" [disabled] [ref=e126]'
            - 'button "E3: Submarine" [disabled] [ref=e127]':
              - generic: ■
            - 'button "F3: open water" [disabled] [ref=e128]'
            - 'button "G3: open water" [disabled] [ref=e129]'
            - 'button "H3: open water" [disabled] [ref=e130]'
            - 'button "I3: open water" [disabled] [ref=e131]'
            - 'button "J3: open water" [disabled] [ref=e132]'
            - generic [ref=e133]: "4"
            - 'button "A4: Battleship" [disabled] [ref=e134]':
              - generic: ■
            - 'button "B4: open water" [disabled] [ref=e135]'
            - 'button "C4: Cruiser" [disabled] [ref=e136]':
              - generic: ■
            - 'button "D4: open water" [disabled] [ref=e137]'
            - 'button "E4: Submarine" [disabled] [ref=e138]':
              - generic: ■
            - 'button "F4: open water" [disabled] [ref=e139]'
            - 'button "G4: open water" [disabled] [ref=e140]'
            - 'button "H4: open water" [disabled] [ref=e141]'
            - 'button "I4: open water" [disabled] [ref=e142]'
            - 'button "J4: open water" [disabled] [ref=e143]'
            - generic [ref=e144]: "5"
            - 'button "A5: Battleship" [disabled] [ref=e145]':
              - generic: ■
            - 'button "B5: open water" [disabled] [ref=e146]'
            - 'button "C5: Cruiser" [disabled] [ref=e147]':
              - generic: ■
            - 'button "D5: open water" [disabled] [ref=e148]'
            - 'button "E5: Submarine" [disabled] [ref=e149]':
              - generic: ■
            - 'button "F5: open water" [disabled] [ref=e150]'
            - 'button "G5: open water" [disabled] [ref=e151]'
            - 'button "H5: open water" [disabled] [ref=e152]'
            - 'button "I5: open water" [disabled] [ref=e153]'
            - 'button "J5: open water" [disabled] [ref=e154]'
            - generic [ref=e155]: "6"
            - 'button "A6: Battleship" [disabled] [ref=e156]':
              - generic: ■
            - 'button "B6: open water" [disabled] [ref=e157]'
            - 'button "C6: open water" [disabled] [ref=e158]'
            - 'button "D6: open water" [disabled] [ref=e159]'
            - 'button "E6: open water" [disabled] [ref=e160]'
            - 'button "F6: open water" [disabled] [ref=e161]'
            - 'button "G6: open water" [disabled] [ref=e162]'
            - 'button "H6: open water" [disabled] [ref=e163]'
            - 'button "I6: open water" [disabled] [ref=e164]'
            - 'button "J6: open water" [disabled] [ref=e165]'
            - generic [ref=e166]: "7"
            - 'button "A7: open water" [disabled] [ref=e167]'
            - 'button "B7: open water" [disabled] [ref=e168]'
            - 'button "C7: open water" [disabled] [ref=e169]'
            - 'button "D7: open water" [disabled] [ref=e170]'
            - 'button "E7: open water" [disabled] [ref=e171]'
            - 'button "F7: open water" [disabled] [ref=e172]'
            - 'button "G7: open water" [disabled] [ref=e173]'
            - 'button "H7: open water" [disabled] [ref=e174]'
            - 'button "I7: Destroyer" [disabled] [ref=e175]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e176]':
              - generic: ■
            - generic [ref=e177]: "8"
            - 'button "A8: open water" [disabled] [ref=e178]'
            - 'button "B8: open water" [disabled] [ref=e179]'
            - 'button "C8: open water" [disabled] [ref=e180]'
            - 'button "D8: open water" [disabled] [ref=e181]'
            - 'button "E8: open water" [disabled] [ref=e182]'
            - 'button "F8: open water" [disabled] [ref=e183]'
            - 'button "G8: open water" [disabled] [ref=e184]'
            - 'button "H8: open water" [disabled] [ref=e185]'
            - 'button "I8: open water" [disabled] [ref=e186]'
            - 'button "J8: open water" [disabled] [ref=e187]'
            - generic [ref=e188]: "9"
            - 'button "A9: open water" [disabled] [ref=e189]'
            - 'button "B9: open water" [disabled] [ref=e190]'
            - 'button "C9: open water" [disabled] [ref=e191]'
            - 'button "D9: open water" [disabled] [ref=e192]'
            - 'button "E9: open water" [disabled] [ref=e193]'
            - 'button "F9: open water" [disabled] [ref=e194]'
            - 'button "G9: open water" [disabled] [ref=e195]'
            - 'button "H9: open water" [disabled] [ref=e196]'
            - 'button "I9: open water" [disabled] [ref=e197]'
            - 'button "J9: open water" [disabled] [ref=e198]'
            - generic [ref=e199]: "10"
            - 'button "A10: open water" [disabled] [ref=e200]'
            - 'button "B10: open water" [disabled] [ref=e201]'
            - 'button "C10: open water" [disabled] [ref=e202]'
            - 'button "D10: open water" [disabled] [ref=e203]'
            - 'button "E10: open water" [disabled] [ref=e204]'
            - 'button "F10: open water" [disabled] [ref=e205]'
            - 'button "G10: open water" [disabled] [ref=e206]'
            - 'button "H10: open water" [disabled] [ref=e207]'
            - 'button "I10: open water" [disabled] [ref=e208]'
            - 'button "J10: open water" [disabled] [ref=e209]'
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