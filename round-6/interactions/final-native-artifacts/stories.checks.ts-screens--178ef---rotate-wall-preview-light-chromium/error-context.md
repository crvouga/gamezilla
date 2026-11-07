# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: stories.checks.ts >> screens-games-quoridor-classic--rotate-wall-preview light
- Location: tests/storybook/stories.checks.ts:27:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/rotate-wall-preview-light.png.
```

# Page snapshot

```yaml
- main [ref=e6]:
  - generic [ref=e12]:
    - generic [ref=e13]:
      - heading "Classic Quoridor" [level=1] [ref=e16]
      - generic [ref=e18]:
        - generic [ref=e19]: Unrated
        - generic [ref=e20]: ·Untimed
    - generic [ref=e21]:
      - generic [ref=e23]:
        - paragraph [ref=e24]: Your turn. Reach row 9.
        - generic [ref=e25]:
          - paragraph [ref=e30]: No moves yet.
          - button "All moves" [ref=e31] [cursor=pointer]:
            - img [ref=e35]
      - generic [ref=e37]:
        - generic [ref=e39]:
          - generic [ref=e41]:
            - generic [ref=e46]:
              - img "North gold diamond" [ref=e47]:
                - generic [ref=e48]: ◆
              - generic "jordan_plays" [ref=e51]
            - generic [ref=e52]:
              - generic [ref=e53]: Walls
              - generic [ref=e54]: "10"
          - generic [ref=e56]:
            - generic [ref=e57]:
              - button "Move pawn" [ref=e58] [cursor=pointer]:
                - paragraph [ref=e61]: Move
              - button "Horizontal wall" [ref=e62] [cursor=pointer]:
                - paragraph [ref=e65]: Horizontal wall
              - button "Vertical wall" [pressed] [ref=e66] [cursor=pointer]:
                - paragraph [ref=e69]: Vertical wall
            - group "Quoridor board, nine columns and nine rows" [ref=e70]:
              - generic [ref=e72]: a
              - generic [ref=e73]: b
              - generic [ref=e74]: c
              - generic [ref=e75]: d
              - generic [ref=e76]: e
              - generic [ref=e77]: f
              - generic [ref=e78]: g
              - generic [ref=e79]: h
              - generic [ref=e80]: i
              - generic [ref=e81]: "9"
              - 'button "a9: Empty, goal edge" [disabled] [ref=e82]'
              - 'button "b9: Empty, goal edge" [disabled] [ref=e83]'
              - 'button "c9: Empty, goal edge" [disabled] [ref=e84]'
              - 'button "d9: Empty, goal edge" [disabled] [ref=e85]'
              - 'button "e9: North gold diamond, goal edge" [disabled] [ref=e86]':
                - generic: ◆
              - 'button "f9: Empty, goal edge" [disabled] [ref=e87]'
              - 'button "g9: Empty, goal edge" [disabled] [ref=e88]'
              - 'button "h9: Empty, goal edge" [disabled] [ref=e89]'
              - 'button "i9: Empty, goal edge" [disabled] [ref=e90]'
              - generic [ref=e91]: "8"
              - 'button "a8: Empty" [ref=e92] [cursor=pointer]'
              - 'button "b8: Empty" [ref=e93] [cursor=pointer]'
              - 'button "c8: Empty" [ref=e94] [cursor=pointer]'
              - 'button "d8: Empty" [ref=e95] [cursor=pointer]'
              - 'button "e8: Empty" [ref=e96] [cursor=pointer]'
              - 'button "f8: Empty" [ref=e97] [cursor=pointer]'
              - 'button "g8: Empty" [ref=e98] [cursor=pointer]'
              - 'button "h8: Empty" [ref=e99] [cursor=pointer]'
              - 'button "i8: Empty" [disabled] [ref=e100]'
              - generic [ref=e101]: "7"
              - 'button "a7: Empty" [ref=e102] [cursor=pointer]'
              - 'button "b7: Empty" [ref=e103] [cursor=pointer]'
              - 'button "c7: Empty" [ref=e104] [cursor=pointer]'
              - 'button "d7: Empty" [ref=e105] [cursor=pointer]'
              - 'button "e7: Empty" [ref=e106] [cursor=pointer]'
              - 'button "f7: Empty" [ref=e107] [cursor=pointer]'
              - 'button "g7: Empty" [ref=e108] [cursor=pointer]'
              - 'button "h7: Empty" [ref=e109] [cursor=pointer]'
              - 'button "i7: Empty" [disabled] [ref=e110]'
              - generic [ref=e111]: "6"
              - 'button "a6: Empty" [ref=e112] [cursor=pointer]'
              - 'button "b6: Empty" [ref=e113] [cursor=pointer]'
              - 'button "c6: Empty" [ref=e114] [cursor=pointer]'
              - 'button "d6: Empty" [ref=e115] [cursor=pointer]'
              - 'button "e6: Empty" [ref=e116] [cursor=pointer]'
              - 'button "f6: Empty" [ref=e117] [cursor=pointer]'
              - 'button "g6: Empty" [ref=e118] [cursor=pointer]'
              - 'button "h6: Empty" [ref=e119] [cursor=pointer]'
              - 'button "i6: Empty" [disabled] [ref=e120]'
              - generic [ref=e121]: "5"
              - 'button "a5: Empty" [ref=e122] [cursor=pointer]'
              - 'button "b5: Empty" [ref=e123] [cursor=pointer]'
              - 'button "c5: Empty" [ref=e124] [cursor=pointer]'
              - 'button "d5: Empty" [ref=e125] [cursor=pointer]'
              - 'button "e5: Empty" [ref=e126] [cursor=pointer]'
              - 'button "f5: Empty" [ref=e127] [cursor=pointer]'
              - 'button "g5: Empty" [ref=e128] [cursor=pointer]'
              - 'button "h5: Empty" [ref=e129] [cursor=pointer]'
              - 'button "i5: Empty" [disabled] [ref=e130]'
              - generic [ref=e131]: "4"
              - 'button "a4: Empty" [ref=e132] [cursor=pointer]'
              - 'button "b4: Empty" [ref=e133] [cursor=pointer]'
              - 'button "c4: Empty" [ref=e134] [cursor=pointer]'
              - 'button "d4: Empty" [ref=e135] [cursor=pointer]'
              - 'button "e4: Empty" [ref=e136] [cursor=pointer]'
              - 'button "f4: Empty" [ref=e137] [cursor=pointer]'
              - 'button "g4: Empty" [ref=e138] [cursor=pointer]'
              - 'button "h4: Empty" [ref=e139] [cursor=pointer]'
              - 'button "i4: Empty" [disabled] [ref=e140]'
              - generic [ref=e141]: "3"
              - 'button "a3: Empty" [ref=e142] [cursor=pointer]'
              - 'button "b3: Empty" [ref=e143] [cursor=pointer]'
              - 'button "c3: Empty" [ref=e144] [cursor=pointer]'
              - 'button "d3: Empty" [ref=e145] [cursor=pointer]'
              - 'button "e3: Empty" [ref=e146] [cursor=pointer]'
              - 'button "f3: Empty" [ref=e147] [cursor=pointer]'
              - 'button "g3: Empty" [ref=e148] [cursor=pointer]'
              - 'button "h3: Empty" [ref=e149] [cursor=pointer]'
              - 'button "i3: Empty" [disabled] [ref=e150]'
              - generic [ref=e151]: "2"
              - 'button "a2: Empty" [ref=e152] [cursor=pointer]'
              - 'button "b2: Empty" [ref=e153] [cursor=pointer]'
              - 'button "c2: Empty" [ref=e154] [cursor=pointer]'
              - 'button "d2: Empty" [ref=e155] [cursor=pointer]'
              - 'button "e2: Empty" [ref=e156] [cursor=pointer]'
              - 'button "f2: Empty" [ref=e157] [cursor=pointer]'
              - 'button "g2: Empty" [ref=e158] [cursor=pointer]'
              - 'button "h2: Empty" [ref=e159] [cursor=pointer]'
              - 'button "i2: Empty" [disabled] [ref=e160]'
              - generic [ref=e161]: "1"
              - 'button "a1: Empty" [ref=e162] [cursor=pointer]'
              - 'button "b1: Empty" [ref=e163] [cursor=pointer]'
              - 'button "c1: Empty" [ref=e164] [cursor=pointer]'
              - 'button "d1: Empty" [ref=e165] [cursor=pointer]'
              - 'button "e1: South red circle" [ref=e166] [cursor=pointer]':
                - generic: ●
              - 'button "f1: Empty" [ref=e167] [cursor=pointer]'
              - 'button "g1: Empty" [ref=e168] [cursor=pointer]'
              - 'button "h1: Empty" [ref=e169] [cursor=pointer]'
              - 'button "i1: Empty" [disabled] [ref=e170]'
            - generic [ref=e171]:
              - paragraph [ref=e172]: Wall anchor
              - button "Wall anchor" [ref=e173] [cursor=pointer]:
                - paragraph [ref=e174]: Right of d4
                - img [ref=e176]
            - generic [ref=e178]:
              - button "Place wall" [ref=e179] [cursor=pointer]:
                - paragraph [ref=e182]: Place wall
              - button "Cancel" [ref=e183] [cursor=pointer]:
                - paragraph [ref=e186]: Cancel
            - status [ref=e187]: Right of d4. Preview only. Place wall to confirm.
          - status [ref=e189]:
            - generic [ref=e190]:
              - generic [ref=e191]: "South red circle: avery. North gold diamond: jordan_plays."
              - text: Your turn. Reach row 9.
          - generic [ref=e194]:
            - generic [ref=e199]:
              - img "South red circle" [ref=e200]:
                - generic [ref=e201]: ●
              - generic "avery" [ref=e204]
              - generic [ref=e205]: Your move
            - generic [ref=e206]:
              - generic [ref=e207]: Walls
              - generic [ref=e208]: "10"
        - generic [ref=e211]:
          - group "Game actions" [ref=e212]:
            - button "Offer draw" [ref=e213] [cursor=pointer]:
              - paragraph [ref=e216]: Offer draw
            - button "Resign game" [ref=e217] [cursor=pointer]:
              - paragraph [ref=e220]:
                - text: Resign
                - generic [ref=e221]: game
          - button "History and stats" [ref=e222] [cursor=pointer]:
            - generic [ref=e224]:
              - paragraph [ref=e225]: History and stats
              - img [ref=e228]
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/libs/quoridor-client-ts/src/baselines/chromium/screens-games-quoridor-classic/rotate-wall-preview-light.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```