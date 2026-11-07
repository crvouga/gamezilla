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
  52136 pixels (ratio 0.16 of all image pixels) are different.

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
  - 52136 pixels (ratio 0.16 of all image pixels) are different.
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
  - 52136 pixels (ratio 0.16 of all image pixels) are different.

```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e10]:
    - status [ref=e11]: All five ships placed. Your fleet is ready.
    - generic [ref=e12]:
      - img [ref=e15]
      - generic [ref=e17]: Your fleet is locked in and can no longer change.
    - generic [ref=e18]:
      - button "Close enlarged placement" [disabled] [ref=e19]:
        - paragraph [ref=e22]: Close enlarged placement
      - generic [ref=e23]:
        - generic [ref=e24]:
          - generic [ref=e25]:
            - paragraph [ref=e26]: Ship
            - button "Ship to place" [disabled] [ref=e27]:
              - paragraph [ref=e28]: Choose a ship to reposition
              - img [ref=e30]
          - generic [ref=e32]:
            - button "Rotate down" [disabled] [ref=e33]:
              - paragraph [ref=e36]: Rotate down
            - button "Remove" [disabled] [ref=e37]:
              - paragraph [ref=e40]: Remove
        - generic [ref=e42]:
          - paragraph [ref=e43]: Region
          - button "Placement area" [disabled] [ref=e44]:
            - paragraph [ref=e45]: A–E / 1–5
            - img [ref=e47]
        - group "Enlarged bow placement" [ref=e51]:
          - generic [ref=e53]: A
          - generic [ref=e54]: B
          - generic [ref=e55]: C
          - generic [ref=e56]: D
          - generic [ref=e57]: E
          - generic [ref=e58]: "1"
          - 'button "A1: Carrier" [disabled] [ref=e59]':
            - generic: ■
          - 'button "B1: Carrier" [disabled] [ref=e60]':
            - generic: ■
          - 'button "C1: Carrier" [disabled] [ref=e61]':
            - generic: ■
          - 'button "D1: Carrier" [disabled] [ref=e62]':
            - generic: ■
          - 'button "E1: Carrier" [disabled] [ref=e63]':
            - generic: ■
          - generic [ref=e64]: "2"
          - 'button "A2: open water" [disabled] [ref=e65]'
          - 'button "B2: open water" [disabled] [ref=e66]'
          - 'button "C2: open water" [disabled] [ref=e67]'
          - 'button "D2: open water" [disabled] [ref=e68]'
          - 'button "E2: open water" [disabled] [ref=e69]'
          - generic [ref=e70]: "3"
          - 'button "A3: Battleship" [disabled] [ref=e71]':
            - generic: ■
          - 'button "B3: open water" [disabled] [ref=e72]'
          - 'button "C3: Cruiser" [disabled] [ref=e73]':
            - generic: ■
          - 'button "D3: open water" [disabled] [ref=e74]'
          - 'button "E3: Submarine" [disabled] [ref=e75]':
            - generic: ■
          - generic [ref=e76]: "4"
          - 'button "A4: Battleship" [disabled] [ref=e77]':
            - generic: ■
          - 'button "B4: open water" [disabled] [ref=e78]'
          - 'button "C4: Cruiser" [disabled] [ref=e79]':
            - generic: ■
          - 'button "D4: open water" [disabled] [ref=e80]'
          - 'button "E4: Submarine" [disabled] [ref=e81]':
            - generic: ■
          - generic [ref=e82]: "5"
          - 'button "A5: Battleship" [disabled] [ref=e83]':
            - generic: ■
          - 'button "B5: open water" [disabled] [ref=e84]'
          - 'button "C5: Cruiser" [disabled] [ref=e85]':
            - generic: ■
          - 'button "D5: open water" [disabled] [ref=e86]'
          - 'button "E5: Submarine" [disabled] [ref=e87]':
            - generic: ■
        - generic [ref=e88]:
          - generic [ref=e89]: Fleet overview
          - group "Your waters" [ref=e91]:
            - generic [ref=e93]: A
            - generic [ref=e94]: B
            - generic [ref=e95]: C
            - generic [ref=e96]: D
            - generic [ref=e97]: E
            - generic [ref=e98]: F
            - generic [ref=e99]: G
            - generic [ref=e100]: H
            - generic [ref=e101]: I
            - generic [ref=e102]: J
            - generic [ref=e103]: "1"
            - 'button "A1: Carrier" [disabled] [ref=e104]':
              - generic: ■
            - 'button "B1: Carrier" [disabled] [ref=e105]':
              - generic: ■
            - 'button "C1: Carrier" [disabled] [ref=e106]':
              - generic: ■
            - 'button "D1: Carrier" [disabled] [ref=e107]':
              - generic: ■
            - 'button "E1: Carrier" [disabled] [ref=e108]':
              - generic: ■
            - 'button "F1: open water" [disabled] [ref=e109]'
            - 'button "G1: open water" [disabled] [ref=e110]'
            - 'button "H1: open water" [disabled] [ref=e111]'
            - 'button "I1: open water" [disabled] [ref=e112]'
            - 'button "J1: open water" [disabled] [ref=e113]'
            - generic [ref=e114]: "2"
            - 'button "A2: open water" [disabled] [ref=e115]'
            - 'button "B2: open water" [disabled] [ref=e116]'
            - 'button "C2: open water" [disabled] [ref=e117]'
            - 'button "D2: open water" [disabled] [ref=e118]'
            - 'button "E2: open water" [disabled] [ref=e119]'
            - 'button "F2: open water" [disabled] [ref=e120]'
            - 'button "G2: open water" [disabled] [ref=e121]'
            - 'button "H2: open water" [disabled] [ref=e122]'
            - 'button "I2: open water" [disabled] [ref=e123]'
            - 'button "J2: open water" [disabled] [ref=e124]'
            - generic [ref=e125]: "3"
            - 'button "A3: Battleship" [disabled] [ref=e126]':
              - generic: ■
            - 'button "B3: open water" [disabled] [ref=e127]'
            - 'button "C3: Cruiser" [disabled] [ref=e128]':
              - generic: ■
            - 'button "D3: open water" [disabled] [ref=e129]'
            - 'button "E3: Submarine" [disabled] [ref=e130]':
              - generic: ■
            - 'button "F3: open water" [disabled] [ref=e131]'
            - 'button "G3: Destroyer" [disabled] [ref=e132]':
              - generic: ■
            - 'button "H3: open water" [disabled] [ref=e133]'
            - 'button "I3: open water" [disabled] [ref=e134]'
            - 'button "J3: open water" [disabled] [ref=e135]'
            - generic [ref=e136]: "4"
            - 'button "A4: Battleship" [disabled] [ref=e137]':
              - generic: ■
            - 'button "B4: open water" [disabled] [ref=e138]'
            - 'button "C4: Cruiser" [disabled] [ref=e139]':
              - generic: ■
            - 'button "D4: open water" [disabled] [ref=e140]'
            - 'button "E4: Submarine" [disabled] [ref=e141]':
              - generic: ■
            - 'button "F4: open water" [disabled] [ref=e142]'
            - 'button "G4: Destroyer" [disabled] [ref=e143]':
              - generic: ■
            - 'button "H4: open water" [disabled] [ref=e144]'
            - 'button "I4: open water" [disabled] [ref=e145]'
            - 'button "J4: open water" [disabled] [ref=e146]'
            - generic [ref=e147]: "5"
            - 'button "A5: Battleship" [disabled] [ref=e148]':
              - generic: ■
            - 'button "B5: open water" [disabled] [ref=e149]'
            - 'button "C5: Cruiser" [disabled] [ref=e150]':
              - generic: ■
            - 'button "D5: open water" [disabled] [ref=e151]'
            - 'button "E5: Submarine" [disabled] [ref=e152]':
              - generic: ■
            - 'button "F5: open water" [disabled] [ref=e153]'
            - 'button "G5: open water" [disabled] [ref=e154]'
            - 'button "H5: open water" [disabled] [ref=e155]'
            - 'button "I5: open water" [disabled] [ref=e156]'
            - 'button "J5: open water" [disabled] [ref=e157]'
            - generic [ref=e158]: "6"
            - 'button "A6: Battleship" [disabled] [ref=e159]':
              - generic: ■
            - 'button "B6: open water" [disabled] [ref=e160]'
            - 'button "C6: open water" [disabled] [ref=e161]'
            - 'button "D6: open water" [disabled] [ref=e162]'
            - 'button "E6: open water" [disabled] [ref=e163]'
            - 'button "F6: open water" [disabled] [ref=e164]'
            - 'button "G6: open water" [disabled] [ref=e165]'
            - 'button "H6: open water" [disabled] [ref=e166]'
            - 'button "I6: open water" [disabled] [ref=e167]'
            - 'button "J6: open water" [disabled] [ref=e168]'
            - generic [ref=e169]: "7"
            - 'button "A7: open water" [disabled] [ref=e170]'
            - 'button "B7: open water" [disabled] [ref=e171]'
            - 'button "C7: open water" [disabled] [ref=e172]'
            - 'button "D7: open water" [disabled] [ref=e173]'
            - 'button "E7: open water" [disabled] [ref=e174]'
            - 'button "F7: open water" [disabled] [ref=e175]'
            - 'button "G7: open water" [disabled] [ref=e176]'
            - 'button "H7: open water" [disabled] [ref=e177]'
            - 'button "I7: open water" [disabled] [ref=e178]'
            - 'button "J7: open water" [disabled] [ref=e179]'
            - generic [ref=e180]: "8"
            - 'button "A8: open water" [disabled] [ref=e181]'
            - 'button "B8: open water" [disabled] [ref=e182]'
            - 'button "C8: open water" [disabled] [ref=e183]'
            - 'button "D8: open water" [disabled] [ref=e184]'
            - 'button "E8: open water" [disabled] [ref=e185]'
            - 'button "F8: open water" [disabled] [ref=e186]'
            - 'button "G8: open water" [disabled] [ref=e187]'
            - 'button "H8: open water" [disabled] [ref=e188]'
            - 'button "I8: open water" [disabled] [ref=e189]'
            - 'button "J8: open water" [disabled] [ref=e190]'
            - generic [ref=e191]: "9"
            - 'button "A9: open water" [disabled] [ref=e192]'
            - 'button "B9: open water" [disabled] [ref=e193]'
            - 'button "C9: open water" [disabled] [ref=e194]'
            - 'button "D9: open water" [disabled] [ref=e195]'
            - 'button "E9: open water" [disabled] [ref=e196]'
            - 'button "F9: open water" [disabled] [ref=e197]'
            - 'button "G9: open water" [disabled] [ref=e198]'
            - 'button "H9: open water" [disabled] [ref=e199]'
            - 'button "I9: open water" [disabled] [ref=e200]'
            - 'button "J9: open water" [disabled] [ref=e201]'
            - generic [ref=e202]: "10"
            - 'button "A10: open water" [disabled] [ref=e203]'
            - 'button "B10: open water" [disabled] [ref=e204]'
            - 'button "C10: open water" [disabled] [ref=e205]'
            - 'button "D10: open water" [disabled] [ref=e206]'
            - 'button "E10: open water" [disabled] [ref=e207]'
            - 'button "F10: open water" [disabled] [ref=e208]'
            - 'button "G10: open water" [disabled] [ref=e209]'
            - 'button "H10: open water" [disabled] [ref=e210]'
            - 'button "I10: open water" [disabled] [ref=e211]'
            - 'button "J10: open water" [disabled] [ref=e212]'
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