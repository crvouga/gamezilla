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
  68452 pixels (ratio 0.06 of all image pixels) are different.

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
  - 68452 pixels (ratio 0.06 of all image pixels) are different.
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
  - 68452 pixels (ratio 0.06 of all image pixels) are different.

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
      - button "Ship to place" [ref=e30] [cursor=pointer]:
        - paragraph [ref=e31]: Select…
        - img [ref=e33]
      - button "Placement area" [ref=e36] [cursor=pointer]:
        - paragraph [ref=e37]: A–E / 1–5
        - img [ref=e39]
      - group "Enlarged bow placement" [ref=e41]:
        - generic [ref=e43]: A
        - generic [ref=e44]: B
        - generic [ref=e45]: C
        - generic [ref=e46]: D
        - generic [ref=e47]: E
        - generic [ref=e48]: "1"
        - 'button "A1: Carrier" [disabled] [ref=e49]':
          - generic: ■
        - 'button "B1: Carrier" [disabled] [ref=e50]':
          - generic: ■
        - 'button "C1: Carrier" [disabled] [ref=e51]':
          - generic: ■
        - 'button "D1: Carrier" [disabled] [ref=e52]':
          - generic: ■
        - 'button "E1: Carrier" [disabled] [ref=e53]':
          - generic: ■
        - generic [ref=e54]: "2"
        - 'button "A2: open water" [disabled] [ref=e55]'
        - 'button "B2: Destroyer" [disabled] [active] [ref=e56]':
          - generic: ■
        - 'button "C2: Destroyer" [disabled] [ref=e57]':
          - generic: ■
        - 'button "D2: open water" [disabled] [ref=e58]'
        - 'button "E2: open water" [disabled] [ref=e59]'
        - generic [ref=e60]: "3"
        - 'button "A3: Battleship" [disabled] [ref=e61]':
          - generic: ■
        - 'button "B3: open water" [disabled] [ref=e62]'
        - 'button "C3: Cruiser" [disabled] [ref=e63]':
          - generic: ■
        - 'button "D3: open water" [disabled] [ref=e64]'
        - 'button "E3: Submarine" [disabled] [ref=e65]':
          - generic: ■
        - generic [ref=e66]: "4"
        - 'button "A4: Battleship" [disabled] [ref=e67]':
          - generic: ■
        - 'button "B4: open water" [disabled] [ref=e68]'
        - 'button "C4: Cruiser" [disabled] [ref=e69]':
          - generic: ■
        - 'button "D4: open water" [disabled] [ref=e70]'
        - 'button "E4: Submarine" [disabled] [ref=e71]':
          - generic: ■
        - generic [ref=e72]: "5"
        - 'button "A5: Battleship" [disabled] [ref=e73]':
          - generic: ■
        - 'button "B5: open water" [disabled] [ref=e74]'
        - 'button "C5: Cruiser" [disabled] [ref=e75]':
          - generic: ■
        - 'button "D5: open water" [disabled] [ref=e76]'
        - 'button "E5: Submarine" [disabled] [ref=e77]':
          - generic: ■
    - group "Your waters" [ref=e78]:
      - generic [ref=e80]: A
      - generic [ref=e81]: B
      - generic [ref=e82]: C
      - generic [ref=e83]: D
      - generic [ref=e84]: E
      - generic [ref=e85]: F
      - generic [ref=e86]: G
      - generic [ref=e87]: H
      - generic [ref=e88]: I
      - generic [ref=e89]: J
      - generic [ref=e90]: "1"
      - 'button "A1: Carrier" [disabled] [ref=e91]':
        - generic: ■
      - 'button "B1: Carrier" [disabled] [ref=e92]':
        - generic: ■
      - 'button "C1: Carrier" [disabled] [ref=e93]':
        - generic: ■
      - 'button "D1: Carrier" [disabled] [ref=e94]':
        - generic: ■
      - 'button "E1: Carrier" [disabled] [ref=e95]':
        - generic: ■
      - 'button "F1: open water" [disabled] [ref=e96]'
      - 'button "G1: open water" [disabled] [ref=e97]'
      - 'button "H1: open water" [disabled] [ref=e98]'
      - 'button "I1: open water" [disabled] [ref=e99]'
      - 'button "J1: open water" [disabled] [ref=e100]'
      - generic [ref=e101]: "2"
      - 'button "A2: open water" [disabled] [ref=e102]'
      - 'button "B2: Destroyer" [disabled] [ref=e103]':
        - generic: ■
      - 'button "C2: Destroyer" [disabled] [ref=e104]':
        - generic: ■
      - 'button "D2: open water" [disabled] [ref=e105]'
      - 'button "E2: open water" [disabled] [ref=e106]'
      - 'button "F2: open water" [disabled] [ref=e107]'
      - 'button "G2: open water" [disabled] [ref=e108]'
      - 'button "H2: open water" [disabled] [ref=e109]'
      - 'button "I2: open water" [disabled] [ref=e110]'
      - 'button "J2: open water" [disabled] [ref=e111]'
      - generic [ref=e112]: "3"
      - 'button "A3: Battleship" [disabled] [ref=e113]':
        - generic: ■
      - 'button "B3: open water" [disabled] [ref=e114]'
      - 'button "C3: Cruiser" [disabled] [ref=e115]':
        - generic: ■
      - 'button "D3: open water" [disabled] [ref=e116]'
      - 'button "E3: Submarine" [disabled] [ref=e117]':
        - generic: ■
      - 'button "F3: open water" [disabled] [ref=e118]'
      - 'button "G3: open water" [disabled] [ref=e119]'
      - 'button "H3: open water" [disabled] [ref=e120]'
      - 'button "I3: open water" [disabled] [ref=e121]'
      - 'button "J3: open water" [disabled] [ref=e122]'
      - generic [ref=e123]: "4"
      - 'button "A4: Battleship" [disabled] [ref=e124]':
        - generic: ■
      - 'button "B4: open water" [disabled] [ref=e125]'
      - 'button "C4: Cruiser" [disabled] [ref=e126]':
        - generic: ■
      - 'button "D4: open water" [disabled] [ref=e127]'
      - 'button "E4: Submarine" [disabled] [ref=e128]':
        - generic: ■
      - 'button "F4: open water" [disabled] [ref=e129]'
      - 'button "G4: open water" [disabled] [ref=e130]'
      - 'button "H4: open water" [disabled] [ref=e131]'
      - 'button "I4: open water" [disabled] [ref=e132]'
      - 'button "J4: open water" [disabled] [ref=e133]'
      - generic [ref=e134]: "5"
      - 'button "A5: Battleship" [disabled] [ref=e135]':
        - generic: ■
      - 'button "B5: open water" [disabled] [ref=e136]'
      - 'button "C5: Cruiser" [disabled] [ref=e137]':
        - generic: ■
      - 'button "D5: open water" [disabled] [ref=e138]'
      - 'button "E5: Submarine" [disabled] [ref=e139]':
        - generic: ■
      - 'button "F5: open water" [disabled] [ref=e140]'
      - 'button "G5: open water" [disabled] [ref=e141]'
      - 'button "H5: open water" [disabled] [ref=e142]'
      - 'button "I5: open water" [disabled] [ref=e143]'
      - 'button "J5: open water" [disabled] [ref=e144]'
      - generic [ref=e145]: "6"
      - 'button "A6: Battleship" [disabled] [ref=e146]':
        - generic: ■
      - 'button "B6: open water" [disabled] [ref=e147]'
      - 'button "C6: open water" [disabled] [ref=e148]'
      - 'button "D6: open water" [disabled] [ref=e149]'
      - 'button "E6: open water" [disabled] [ref=e150]'
      - 'button "F6: open water" [disabled] [ref=e151]'
      - 'button "G6: open water" [disabled] [ref=e152]'
      - 'button "H6: open water" [disabled] [ref=e153]'
      - 'button "I6: open water" [disabled] [ref=e154]'
      - 'button "J6: open water" [disabled] [ref=e155]'
      - generic [ref=e156]: "7"
      - 'button "A7: open water" [disabled] [ref=e157]'
      - 'button "B7: open water" [disabled] [ref=e158]'
      - 'button "C7: open water" [disabled] [ref=e159]'
      - 'button "D7: open water" [disabled] [ref=e160]'
      - 'button "E7: open water" [disabled] [ref=e161]'
      - 'button "F7: open water" [disabled] [ref=e162]'
      - 'button "G7: open water" [disabled] [ref=e163]'
      - 'button "H7: open water" [disabled] [ref=e164]'
      - 'button "I7: open water" [disabled] [ref=e165]'
      - 'button "J7: open water" [disabled] [ref=e166]'
      - generic [ref=e167]: "8"
      - 'button "A8: open water" [disabled] [ref=e168]'
      - 'button "B8: open water" [disabled] [ref=e169]'
      - 'button "C8: open water" [disabled] [ref=e170]'
      - 'button "D8: open water" [disabled] [ref=e171]'
      - 'button "E8: open water" [disabled] [ref=e172]'
      - 'button "F8: open water" [disabled] [ref=e173]'
      - 'button "G8: open water" [disabled] [ref=e174]'
      - 'button "H8: open water" [disabled] [ref=e175]'
      - 'button "I8: open water" [disabled] [ref=e176]'
      - 'button "J8: open water" [disabled] [ref=e177]'
      - generic [ref=e178]: "9"
      - 'button "A9: open water" [disabled] [ref=e179]'
      - 'button "B9: open water" [disabled] [ref=e180]'
      - 'button "C9: open water" [disabled] [ref=e181]'
      - 'button "D9: open water" [disabled] [ref=e182]'
      - 'button "E9: open water" [disabled] [ref=e183]'
      - 'button "F9: open water" [disabled] [ref=e184]'
      - 'button "G9: open water" [disabled] [ref=e185]'
      - 'button "H9: open water" [disabled] [ref=e186]'
      - 'button "I9: open water" [disabled] [ref=e187]'
      - 'button "J9: open water" [disabled] [ref=e188]'
      - generic [ref=e189]: "10"
      - 'button "A10: open water" [disabled] [ref=e190]'
      - 'button "B10: open water" [disabled] [ref=e191]'
      - 'button "C10: open water" [disabled] [ref=e192]'
      - 'button "D10: open water" [disabled] [ref=e193]'
      - 'button "E10: open water" [disabled] [ref=e194]'
      - 'button "F10: open water" [disabled] [ref=e195]'
      - 'button "G10: open water" [disabled] [ref=e196]'
      - 'button "H10: open water" [disabled] [ref=e197]'
      - 'button "I10: open water" [disabled] [ref=e198]'
      - 'button "J10: open water" [disabled] [ref=e199]'
    - group "Ships" [ref=e200]:
      - generic [ref=e201]: Ships
      - generic [ref=e202]:
        - generic [ref=e203] [cursor=pointer]:
          - radio "Carrier A1, across" [ref=e204]
          - generic [ref=e205]: Carrier
          - generic [ref=e206]: A1, across
        - generic [ref=e207] [cursor=pointer]:
          - radio "Battleship A3, down" [ref=e208]
          - generic [ref=e209]: Battleship
          - generic [ref=e210]: A3, down
        - generic [ref=e211] [cursor=pointer]:
          - radio "Cruiser C3, down" [ref=e212]
          - generic [ref=e213]: Cruiser
          - generic [ref=e214]: C3, down
        - generic [ref=e215] [cursor=pointer]:
          - radio "Submarine E3, down" [ref=e216]
          - generic [ref=e217]: Submarine
          - generic [ref=e218]: E3, down
        - generic [ref=e219] [cursor=pointer]:
          - radio "Destroyer B2, across" [ref=e220]
          - generic [ref=e221]: Destroyer
          - generic [ref=e222]: B2, across
    - paragraph [ref=e223]: Choose a placed ship to move or remove it.
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