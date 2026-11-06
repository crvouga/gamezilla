from pathlib import Path
import json
p=Path('libs/battleship-client-ts/src/battleship-target-grid.tsx');s=p.read_text();assert '<StackVertical gap="sm" width="full">' in s;s=s.replace('<StackVertical gap="sm" width="full">','<StackVertical gap="xs" width="full">');p.write_text(s)
p=Path('pkgs/ui-root-harness-ts/tests/storybook/board-round-five.checks.ts');s=p.read_text();s+='''
// regression: battleship-desktop-target-tools-below-viewport
test('screens-games-battleship-board--correct-target-before-firing regression battleship-desktop-target-tools-below-viewport', async ({ page }) => {
  const story = index.entries['screens-games-battleship-board--correct-target-before-firing'];
  if (!story) throw new Error('Missing literal desktop targeting regression');
  const scenario = visualScenarios(story).find(item => item.width === 1440 && item.theme === 'light');
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});
''';p.write_text(s)
Path('libs/tools-harness-ts/goal/known-bugs/battleship-desktop-target-tools-below-viewport.json').write_text(json.dumps({'summary':'At 1440x844, correct-target-before-firing starts with Larger targets ending at 848.34375px, below the viewport, while the grid and Fire action fit. Tighten the grouped target-grid spacing without shrinking controls or scrolling before measurement.','regressionTest':'pkgs/ui-root-harness-ts/tests/storybook/board-round-five.checks.ts'},indent=2)+'\n')
