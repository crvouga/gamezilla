# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-battleship-setup--enlarged-placement dark-1440
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: expect(locator).toHaveScreenshot(expected) failed

Locator: locator('#storybook-root')
  57736 pixels (ratio 0.05 of all image pixels) are different.

  Snapshot: libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-dark-1440.png

Call log:
  - Expect "toHaveScreenshot(libs/battleship-client-ts/src/baselines/chromium/screens-games-battleship-setup/enlarged-placement-dark-1440.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - waiting for locator('#storybook-root')
    - locator resolved to <div id="storybook-root" data-story-ready="true" data-story-status="success">…</div>
  - taking element screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - attempting scroll into view action
    - waiting for element to be stable
  - 57736 pixels (ratio 0.05 of all image pixels) are different.
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
  - 57736 pixels (ratio 0.05 of all image pixels) are different.

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
        - generic [ref=e39]:
          - paragraph [ref=e40]: Region
          - button "Placement area" [ref=e41] [cursor=pointer]:
            - paragraph [ref=e42]: F–J / 6–10
            - img [ref=e44]
        - paragraph [ref=e47]: Choose a placed ship to move or remove it.
        - group "Enlarged bow placement" [ref=e49]:
          - generic [ref=e51]: F
          - generic [ref=e52]: G
          - generic [ref=e53]: H
          - generic [ref=e54]: I
          - generic [ref=e55]: J
          - generic [ref=e56]: "6"
          - 'button "F6: open water" [disabled] [ref=e57]'
          - 'button "G6: open water" [disabled] [ref=e58]'
          - 'button "H6: open water" [disabled] [ref=e59]'
          - 'button "I6: open water" [disabled] [ref=e60]'
          - 'button "J6: open water" [disabled] [ref=e61]'
          - generic [ref=e62]: "7"
          - 'button "F7: open water" [disabled] [ref=e63]'
          - 'button "G7: open water" [disabled] [ref=e64]'
          - 'button "H7: open water" [disabled] [ref=e65]'
          - 'button "I7: Destroyer" [disabled] [active] [ref=e66]':
            - generic: ■
          - 'button "J7: Destroyer" [disabled] [ref=e67]':
            - generic: ■
          - generic [ref=e68]: "8"
          - 'button "F8: open water" [disabled] [ref=e69]'
          - 'button "G8: open water" [disabled] [ref=e70]'
          - 'button "H8: open water" [disabled] [ref=e71]'
          - 'button "I8: open water" [disabled] [ref=e72]'
          - 'button "J8: open water" [disabled] [ref=e73]'
          - generic [ref=e74]: "9"
          - 'button "F9: open water" [disabled] [ref=e75]'
          - 'button "G9: open water" [disabled] [ref=e76]'
          - 'button "H9: open water" [disabled] [ref=e77]'
          - 'button "I9: open water" [disabled] [ref=e78]'
          - 'button "J9: open water" [disabled] [ref=e79]'
          - generic [ref=e80]: "10"
          - 'button "F10: open water" [disabled] [ref=e81]'
          - 'button "G10: open water" [disabled] [ref=e82]'
          - 'button "H10: open water" [disabled] [ref=e83]'
          - 'button "I10: open water" [disabled] [ref=e84]'
          - 'button "J10: open water" [disabled] [ref=e85]'
        - generic [ref=e86]:
          - generic [ref=e87]: Fleet overview
          - group "Your waters" [ref=e89]:
            - generic [ref=e91]: A
            - generic [ref=e92]: B
            - generic [ref=e93]: C
            - generic [ref=e94]: D
            - generic [ref=e95]: E
            - generic [ref=e96]: F
            - generic [ref=e97]: G
            - generic [ref=e98]: H
            - generic [ref=e99]: I
            - generic [ref=e100]: J
            - generic [ref=e101]: "1"
            - 'button "A1: Carrier" [disabled] [ref=e102]':
              - generic: ■
            - 'button "B1: Carrier" [disabled] [ref=e103]':
              - generic: ■
            - 'button "C1: Carrier" [disabled] [ref=e104]':
              - generic: ■
            - 'button "D1: Carrier" [disabled] [ref=e105]':
              - generic: ■
            - 'button "E1: Carrier" [disabled] [ref=e106]':
              - generic: ■
            - 'button "F1: open water" [disabled] [ref=e107]'
            - 'button "G1: open water" [disabled] [ref=e108]'
            - 'button "H1: open water" [disabled] [ref=e109]'
            - 'button "I1: open water" [disabled] [ref=e110]'
            - 'button "J1: open water" [disabled] [ref=e111]'
            - generic [ref=e112]: "2"
            - 'button "A2: open water" [disabled] [ref=e113]'
            - 'button "B2: open water" [disabled] [ref=e114]'
            - 'button "C2: open water" [disabled] [ref=e115]'
            - 'button "D2: open water" [disabled] [ref=e116]'
            - 'button "E2: open water" [disabled] [ref=e117]'
            - 'button "F2: open water" [disabled] [ref=e118]'
            - 'button "G2: Cruiser" [disabled] [ref=e119]':
              - generic: ■
            - 'button "H2: open water" [disabled] [ref=e120]'
            - 'button "I2: open water" [disabled] [ref=e121]'
            - 'button "J2: open water" [disabled] [ref=e122]'
            - generic [ref=e123]: "3"
            - 'button "A3: Battleship" [disabled] [ref=e124]':
              - generic: ■
            - 'button "B3: open water" [disabled] [ref=e125]'
            - 'button "C3: open water" [disabled] [ref=e126]'
            - 'button "D3: open water" [disabled] [ref=e127]'
            - 'button "E3: open water" [disabled] [ref=e128]'
            - 'button "F3: open water" [disabled] [ref=e129]'
            - 'button "G3: Cruiser" [disabled] [ref=e130]':
              - generic: ■
            - 'button "H3: open water" [disabled] [ref=e131]'
            - 'button "I3: open water" [disabled] [ref=e132]'
            - 'button "J3: open water" [disabled] [ref=e133]'
            - generic [ref=e134]: "4"
            - 'button "A4: Battleship" [disabled] [ref=e135]':
              - generic: ■
            - 'button "B4: open water" [disabled] [ref=e136]'
            - 'button "C4: open water" [disabled] [ref=e137]'
            - 'button "D4: open water" [disabled] [ref=e138]'
            - 'button "E4: open water" [disabled] [ref=e139]'
            - 'button "F4: open water" [disabled] [ref=e140]'
            - 'button "G4: Cruiser" [disabled] [ref=e141]':
              - generic: ■
            - 'button "H4: open water" [disabled] [ref=e142]'
            - 'button "I4: open water" [disabled] [ref=e143]'
            - 'button "J4: open water" [disabled] [ref=e144]'
            - generic [ref=e145]: "5"
            - 'button "A5: Battleship" [disabled] [ref=e146]':
              - generic: ■
            - 'button "B5: open water" [disabled] [ref=e147]'
            - 'button "C5: open water" [disabled] [ref=e148]'
            - 'button "D5: open water" [disabled] [ref=e149]'
            - 'button "E5: open water" [disabled] [ref=e150]'
            - 'button "F5: open water" [disabled] [ref=e151]'
            - 'button "G5: open water" [disabled] [ref=e152]'
            - 'button "H5: open water" [disabled] [ref=e153]'
            - 'button "I5: open water" [disabled] [ref=e154]'
            - 'button "J5: open water" [disabled] [ref=e155]'
            - generic [ref=e156]: "6"
            - 'button "A6: Battleship" [disabled] [ref=e157]':
              - generic: ■
            - 'button "B6: open water" [disabled] [ref=e158]'
            - 'button "C6: open water" [disabled] [ref=e159]'
            - 'button "D6: open water" [disabled] [ref=e160]'
            - 'button "E6: open water" [disabled] [ref=e161]'
            - 'button "F6: open water" [disabled] [ref=e162]'
            - 'button "G6: open water" [disabled] [ref=e163]'
            - 'button "H6: open water" [disabled] [ref=e164]'
            - 'button "I6: open water" [disabled] [ref=e165]'
            - 'button "J6: open water" [disabled] [ref=e166]'
            - generic [ref=e167]: "7"
            - 'button "A7: open water" [disabled] [ref=e168]'
            - 'button "B7: open water" [disabled] [ref=e169]'
            - 'button "C7: open water" [disabled] [ref=e170]'
            - 'button "D7: open water" [disabled] [ref=e171]'
            - 'button "E7: open water" [disabled] [ref=e172]'
            - 'button "F7: open water" [disabled] [ref=e173]'
            - 'button "G7: open water" [disabled] [ref=e174]'
            - 'button "H7: open water" [disabled] [ref=e175]'
            - 'button "I7: Destroyer" [disabled] [ref=e176]':
              - generic: ■
            - 'button "J7: Destroyer" [disabled] [ref=e177]':
              - generic: ■
            - generic [ref=e178]: "8"
            - 'button "A8: open water" [disabled] [ref=e179]'
            - 'button "B8: Submarine" [disabled] [ref=e180]':
              - generic: ■
            - 'button "C8: Submarine" [disabled] [ref=e181]':
              - generic: ■
            - 'button "D8: Submarine" [disabled] [ref=e182]':
              - generic: ■
            - 'button "E8: open water" [disabled] [ref=e183]'
            - 'button "F8: open water" [disabled] [ref=e184]'
            - 'button "G8: open water" [disabled] [ref=e185]'
            - 'button "H8: open water" [disabled] [ref=e186]'
            - 'button "I8: open water" [disabled] [ref=e187]'
            - 'button "J8: open water" [disabled] [ref=e188]'
            - generic [ref=e189]: "9"
            - 'button "A9: open water" [disabled] [ref=e190]'
            - 'button "B9: open water" [disabled] [ref=e191]'
            - 'button "C9: open water" [disabled] [ref=e192]'
            - 'button "D9: open water" [disabled] [ref=e193]'
            - 'button "E9: open water" [disabled] [ref=e194]'
            - 'button "F9: open water" [disabled] [ref=e195]'
            - 'button "G9: open water" [disabled] [ref=e196]'
            - 'button "H9: open water" [disabled] [ref=e197]'
            - 'button "I9: open water" [disabled] [ref=e198]'
            - 'button "J9: open water" [disabled] [ref=e199]'
            - generic [ref=e200]: "10"
            - 'button "A10: open water" [disabled] [ref=e201]'
            - 'button "B10: open water" [disabled] [ref=e202]'
            - 'button "C10: open water" [disabled] [ref=e203]'
            - 'button "D10: open water" [disabled] [ref=e204]'
            - 'button "E10: open water" [disabled] [ref=e205]'
            - 'button "F10: open water" [disabled] [ref=e206]'
            - 'button "G10: open water" [disabled] [ref=e207]'
            - 'button "H10: open water" [disabled] [ref=e208]'
            - 'button "I10: open water" [disabled] [ref=e209]'
            - 'button "J10: open water" [disabled] [ref=e210]'
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