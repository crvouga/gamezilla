# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: board-round-five.checks.ts >> components-inputs-trailarena--states dark-1440
- Location: tests/storybook/board-round-five.checks.ts:149:5

# Error details

```
Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/trail-arena/baselines/chromium/components-inputs-trailarena/states-dark-1440.png.
```

# Page snapshot

```yaml
- generic [ref=e6]:
  - generic [ref=e7]:
    - paragraph [ref=e8]: Duel, steered here
    - generic [ref=e9]:
      - paragraph [ref=e10]: Focus the arena. Steer Comet with the arrow keys, WASD, a swipe or the pad; each press rides one cell.
      - application "Duel arena" [ref=e11]:
        - img [ref=e12]:
          - generic [ref=e18]:
            - generic: C
          - generic [ref=e22]:
            - generic: E
        - status
      - group [ref=e25]:
        - button "Steer up" [ref=e26] [cursor=pointer]:
          - img [ref=e27]
        - button "Steer left" [ref=e29] [cursor=pointer]:
          - img [ref=e30]
        - button "Steer right" [ref=e32] [cursor=pointer]:
          - img [ref=e33]
        - button "Steer down" [ref=e35] [cursor=pointer]:
          - img [ref=e36]
  - generic [ref=e38]:
    - paragraph [ref=e39]: Duel, two riders on one keyboard
    - generic [ref=e40]:
      - paragraph [ref=e41]: Comet steers with the arrow keys, Ember with WASD. The pad steers Comet.
      - application "Shared keyboard arena" [ref=e42]:
        - img [ref=e43]:
          - generic [ref=e49]:
            - generic: C
          - generic [ref=e53]:
            - generic: E
        - generic:
          - generic: Left rider · WASD
          - generic: Right rider · arrows
        - status
      - group [ref=e57]:
        - button "Steer up" [ref=e58] [cursor=pointer]:
          - img [ref=e59]
        - button "Steer left" [ref=e61] [cursor=pointer]:
          - img [ref=e62]
        - button "Steer right" [ref=e64] [cursor=pointer]:
          - img [ref=e65]
        - button "Steer down" [ref=e67] [cursor=pointer]:
          - img [ref=e68]
  - paragraph [ref=e70]: "These arenas are read-only: nothing here is steered from this device."
  - generic [ref=e71]:
    - paragraph [ref=e72]: "Trio, watched: Ember crashed into Comet's trail"
    - application "Trio arena, watching" [ref=e73]:
      - img [ref=e74]:
        - generic [ref=e81]:
          - generic: C
        - generic [ref=e84]:
          - generic: E
        - generic [ref=e86]:
          - generic: "N"
      - status
  - generic [ref=e92]:
    - paragraph [ref=e93]: Quad, countdown before the round
    - application "Quad arena, countdown" [ref=e94]:
      - img [ref=e95]:
        - generic [ref=e103]:
          - generic: C
        - generic [ref=e107]:
          - generic: E
        - generic [ref=e110]:
          - generic: "N"
        - generic [ref=e113]:
          - generic: V
      - status:
        - generic:
          - generic: "3"
          - generic: Round 2
  - generic [ref=e116]:
    - paragraph [ref=e117]: "Quad, round over: three crashes and a result"
    - application "Quad arena, round over" [ref=e118]:
      - img [ref=e119]:
        - generic [ref=e127]:
          - generic: C
        - generic [ref=e131]:
          - generic: E
        - generic [ref=e133]:
          - generic: "N"
        - generic [ref=e135]:
          - generic: V
      - status:
        - generic:
          - generic: Comet wins the round
          - generic: Comet 2, Ember 1
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
     |                                                 ^ Error: A snapshot doesn't exist at /Users/chrisvouga/.t3/worktrees/gamezilla/t3-cdbe42ba/pkgs/ui-root-client-ts/src/trail-arena/baselines/chromium/components-inputs-trailarena/states-dark-1440.png.
  52 |     scenario.baseline.split('/'),
  53 |     { animations: 'disabled' }
  54 |   );
  55 | }
  56 | 
```