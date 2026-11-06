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
  65915 pixels (ratio 0.06 of all image pixels) are different.

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
  - 65915 pixels (ratio 0.06 of all image pixels) are different.
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
  - 65915 pixels (ratio 0.06 of all image pixels) are different.

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
    - generic [ref=e24]:
      - button "Close enlarged placement" [ref=e25] [cursor=pointer]:
        - paragraph [ref=e28]: Close enlarged placement
      - generic [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]:
            - paragraph [ref=e32]: Ship
            - button "Ship to place" [ref=e33] [cursor=pointer]:
              - paragraph [ref=e34]: Choose a ship to reposition
              - img [ref=e36]
          - generic [ref=e38]:
            - paragraph [ref=e39]: Region
            - button "Placement area" [ref=e40] [cursor=pointer]:
              - paragraph [ref=e41]: F–J / 6–10
              - img [ref=e43]
          - group "Enlarged bow placement" [ref=e45]:
            - generic [ref=e47]: F
            - generic [ref=e48]: G
            - generic [ref=e49]: H
            - generic [ref=e50]: I
            - generic [ref=e51]: J
            - generic [ref=e52]: "6"
            - 'button "F6: open water" [disabled] [ref=e53]'
            - 'button "G6: open water" [disabled] [ref=e54]'
            - 'button "H6: open water" [disabled] [ref=e55]'
            - 'button "I6: open water" [disabled] [ref=e56]'
            - 'button "J6: open water" [disabled] [ref=e57]'
            - generic [ref=e58]: "7"
            - 'button "F7: open water" [disabled] [ref=e59]'
            - 'button "G7: open water" [disabled] [ref=e60]'
            - 'button "H7: open water" [disabled] [ref=e61]'
            - 'button "I7: Destroyer" [disabled] [active] [ref=e62]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e63]':
              - generic: ■
            - generic [ref=e64]: "8"
            - 'button "F8: open water" [disabled] [ref=e65]'
            - 'button "G8: open water" [disabled] [ref=e66]'
            - 'button "H8: open water" [disabled] [ref=e67]'
            - 'button "I8: open water" [disabled] [ref=e68]'
            - 'button "J8: open water" [disabled] [ref=e69]'
            - generic [ref=e70]: "9"
            - 'button "F9: open water" [disabled] [ref=e71]'
            - 'button "G9: open water" [disabled] [ref=e72]'
            - 'button "H9: open water" [disabled] [ref=e73]'
            - 'button "I9: open water" [disabled] [ref=e74]'
            - 'button "J9: open water" [disabled] [ref=e75]'
            - generic [ref=e76]: "10"
            - 'button "F10: open water" [disabled] [ref=e77]'
            - 'button "G10: open water" [disabled] [ref=e78]'
            - 'button "H10: open water" [disabled] [ref=e79]'
            - 'button "I10: open water" [disabled] [ref=e80]'
            - 'button "J10: open water" [disabled] [ref=e81]'
        - generic [ref=e82]:
          - generic [ref=e83]: Fleet overview
          - group "Your waters" [ref=e85]:
            - generic [ref=e87]: A
            - generic [ref=e88]: B
            - generic [ref=e89]: C
            - generic [ref=e90]: D
            - generic [ref=e91]: E
            - generic [ref=e92]: F
            - generic [ref=e93]: G
            - generic [ref=e94]: H
            - generic [ref=e95]: I
            - generic [ref=e96]: J
            - generic [ref=e97]: "1"
            - 'button "A1: Carrier" [disabled] [ref=e98]':
              - generic: ■
            - 'button "B1: Carrier" [disabled] [ref=e99]':
              - generic: ■
            - 'button "C1: Carrier" [disabled] [ref=e100]':
              - generic: ■
            - 'button "D1: Carrier" [disabled] [ref=e101]':
              - generic: ■
            - 'button "E1: Carrier" [disabled] [ref=e102]':
              - generic: ■
            - 'button "F1: open water" [disabled] [ref=e103]'
            - 'button "G1: open water" [disabled] [ref=e104]'
            - 'button "H1: open water" [disabled] [ref=e105]'
            - 'button "I1: open water" [disabled] [ref=e106]'
            - 'button "J1: open water" [disabled] [ref=e107]'
            - generic [ref=e108]: "2"
            - 'button "A2: open water" [disabled] [ref=e109]'
            - 'button "B2: open water" [disabled] [ref=e110]'
            - 'button "C2: open water" [disabled] [ref=e111]'
            - 'button "D2: open water" [disabled] [ref=e112]'
            - 'button "E2: open water" [disabled] [ref=e113]'
            - 'button "F2: open water" [disabled] [ref=e114]'
            - 'button "G2: open water" [disabled] [ref=e115]'
            - 'button "H2: open water" [disabled] [ref=e116]'
            - 'button "I2: open water" [disabled] [ref=e117]'
            - 'button "J2: open water" [disabled] [ref=e118]'
            - generic [ref=e119]: "3"
            - 'button "A3: Battleship" [disabled] [ref=e120]':
              - generic: ■
            - 'button "B3: open water" [disabled] [ref=e121]'
            - 'button "C3: Cruiser" [disabled] [ref=e122]':
              - generic: ■
            - 'button "D3: open water" [disabled] [ref=e123]'
            - 'button "E3: Submarine" [disabled] [ref=e124]':
              - generic: ■
            - 'button "F3: open water" [disabled] [ref=e125]'
            - 'button "G3: open water" [disabled] [ref=e126]'
            - 'button "H3: open water" [disabled] [ref=e127]'
            - 'button "I3: open water" [disabled] [ref=e128]'
            - 'button "J3: open water" [disabled] [ref=e129]'
            - generic [ref=e130]: "4"
            - 'button "A4: Battleship" [disabled] [ref=e131]':
              - generic: ■
            - 'button "B4: open water" [disabled] [ref=e132]'
            - 'button "C4: Cruiser" [disabled] [ref=e133]':
              - generic: ■
            - 'button "D4: open water" [disabled] [ref=e134]'
            - 'button "E4: Submarine" [disabled] [ref=e135]':
              - generic: ■
            - 'button "F4: open water" [disabled] [ref=e136]'
            - 'button "G4: open water" [disabled] [ref=e137]'
            - 'button "H4: open water" [disabled] [ref=e138]'
            - 'button "I4: open water" [disabled] [ref=e139]'
            - 'button "J4: open water" [disabled] [ref=e140]'
            - generic [ref=e141]: "5"
            - 'button "A5: Battleship" [disabled] [ref=e142]':
              - generic: ■
            - 'button "B5: open water" [disabled] [ref=e143]'
            - 'button "C5: Cruiser" [disabled] [ref=e144]':
              - generic: ■
            - 'button "D5: open water" [disabled] [ref=e145]'
            - 'button "E5: Submarine" [disabled] [ref=e146]':
              - generic: ■
            - 'button "F5: open water" [disabled] [ref=e147]'
            - 'button "G5: open water" [disabled] [ref=e148]'
            - 'button "H5: open water" [disabled] [ref=e149]'
            - 'button "I5: open water" [disabled] [ref=e150]'
            - 'button "J5: open water" [disabled] [ref=e151]'
            - generic [ref=e152]: "6"
            - 'button "A6: Battleship" [disabled] [ref=e153]':
              - generic: ■
            - 'button "B6: open water" [disabled] [ref=e154]'
            - 'button "C6: open water" [disabled] [ref=e155]'
            - 'button "D6: open water" [disabled] [ref=e156]'
            - 'button "E6: open water" [disabled] [ref=e157]'
            - 'button "F6: open water" [disabled] [ref=e158]'
            - 'button "G6: open water" [disabled] [ref=e159]'
            - 'button "H6: open water" [disabled] [ref=e160]'
            - 'button "I6: open water" [disabled] [ref=e161]'
            - 'button "J6: open water" [disabled] [ref=e162]'
            - generic [ref=e163]: "7"
            - 'button "A7: open water" [disabled] [ref=e164]'
            - 'button "B7: open water" [disabled] [ref=e165]'
            - 'button "C7: open water" [disabled] [ref=e166]'
            - 'button "D7: open water" [disabled] [ref=e167]'
            - 'button "E7: open water" [disabled] [ref=e168]'
            - 'button "F7: open water" [disabled] [ref=e169]'
            - 'button "G7: open water" [disabled] [ref=e170]'
            - 'button "H7: open water" [disabled] [ref=e171]'
            - 'button "I7: Destroyer" [disabled] [ref=e172]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e173]':
              - generic: ■
            - generic [ref=e174]: "8"
            - 'button "A8: open water" [disabled] [ref=e175]'
            - 'button "B8: open water" [disabled] [ref=e176]'
            - 'button "C8: open water" [disabled] [ref=e177]'
            - 'button "D8: open water" [disabled] [ref=e178]'
            - 'button "E8: open water" [disabled] [ref=e179]'
            - 'button "F8: open water" [disabled] [ref=e180]'
            - 'button "G8: open water" [disabled] [ref=e181]'
            - 'button "H8: open water" [disabled] [ref=e182]'
            - 'button "I8: open water" [disabled] [ref=e183]'
            - 'button "J8: open water" [disabled] [ref=e184]'
            - generic [ref=e185]: "9"
            - 'button "A9: open water" [disabled] [ref=e186]'
            - 'button "B9: open water" [disabled] [ref=e187]'
            - 'button "C9: open water" [disabled] [ref=e188]'
            - 'button "D9: open water" [disabled] [ref=e189]'
            - 'button "E9: open water" [disabled] [ref=e190]'
            - 'button "F9: open water" [disabled] [ref=e191]'
            - 'button "G9: open water" [disabled] [ref=e192]'
            - 'button "H9: open water" [disabled] [ref=e193]'
            - 'button "I9: open water" [disabled] [ref=e194]'
            - 'button "J9: open water" [disabled] [ref=e195]'
            - generic [ref=e196]: "10"
            - 'button "A10: open water" [disabled] [ref=e197]'
            - 'button "B10: open water" [disabled] [ref=e198]'
            - 'button "C10: open water" [disabled] [ref=e199]'
            - 'button "D10: open water" [disabled] [ref=e200]'
            - 'button "E10: open water" [disabled] [ref=e201]'
            - 'button "F10: open water" [disabled] [ref=e202]'
            - 'button "G10: open water" [disabled] [ref=e203]'
            - 'button "H10: open water" [disabled] [ref=e204]'
            - 'button "I10: open water" [disabled] [ref=e205]'
            - 'button "J10: open water" [disabled] [ref=e206]'
    - paragraph [ref=e207]: Choose a placed ship to move or remove it.
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