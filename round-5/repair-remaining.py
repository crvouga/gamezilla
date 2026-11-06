from pathlib import Path
import json
p=Path('libs/sokoban-client-ts/src/sokoban-history.example.tsx');s=p.read_text().replace('  return (\n    <StoryPackAttempt','  const [completionSaved, setCompletionSaved] = createSignal(\n    rules.complete(props.definition, state())\n  );\n  return (\n    <StoryPackAttempt').replace('complete={rules.complete(props.definition, state())}','complete={completionSaved()}').replace('            props.onAction(action);','            props.onAction(action);\n            if (rules.complete(props.definition, next.state)) setCompletionSaved(true);');p.write_text(s)
p=Path('libs/sokoban-client-ts/src/sokoban-player.stories.tsx');s=p.read_text().replace("canvas.getByText('Puzzle completed')","canvas.getByTestId('sokoban-solved')").replace("      'Puzzle completed'","      'All crates are on goals'").replace("canvas.queryByText('Puzzle completed')","canvas.queryByTestId('sokoban-solved')")
s=s.replace("      canvas.queryByTestId('sokoban-solved')\n    ).not.toBeInTheDocument();", "      canvas.queryByTestId('sokoban-solved')\n    ).not.toBeInTheDocument();\n    await expect(canvas.getByText('Completion saved')).toBeInTheDocument();")
p.write_text(s)
p=Path('pkgs/ui-root-client-ts/src/word-tile-board/index.tsx');s=p.read_text().replace('export type WordTileBoardProps = {','export type WordTileBoardProps = {\n  /** Compact fitted board leaves room for rack and puzzle actions; enlarged cells stay full size. */\n  readonly measure?: \'full\' | \'compact\';').replace('            class={styles[\'board\']}','            class={styles[\'board\']}\n            data-measure={props.measure ?? \'full\'}');p.write_text(s)
p=Path('pkgs/ui-root-client-ts/src/word-tile-board/word-tile-board.module.css');s=p.read_text();s+='\n/* A complete fitted puzzle board alongside its rack and target at desktop height. */\n.board[data-measure="compact"][data-enlarged="false"] {\n  max-width: calc(var(--ui-control-size-lg) * 10);\n}\n';p.write_text(s)
p=Path('libs/word-tiles-client-ts/src/word-tiles-puzzle-player-view.tsx');s=p.read_text().replace('      <WordTileBoard\n','      <WordTileBoard\n        measure="compact"\n');p.write_text(s)
p=Path('pkgs/ui-root-harness-ts/tests/storybook/board-round-five.checks.ts');s=p.read_text();s+='''
// regression: sokoban-history-forgets-saved-completion
test('screens-games-sokoban-puzzle--corner-recovery regression sokoban-history-forgets-saved-completion', async ({ page }) => {
  const story = index.entries['screens-games-sokoban-puzzle--corner-recovery'];
  if (!story) throw new Error('Missing literal saved completion regression');
  const scenario = visualScenarios(story).find(item => item.width === 390 && item.theme === 'light');
  if (!scenario) throw new Error('Missing phone light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});
''';p.write_text(s)
p=Path('pkgs/ui-root-harness-ts/tests/storybook/word-tiles-round-five.checks.ts');s=p.read_text();s+='''
// regression: word-tiles-puzzle-desktop-board-overflow
test('screens-games-word-tiles-puzzle--enlarged-blank regression word-tiles-puzzle-desktop-board-overflow', async ({ page }) => {
  const story = index.entries['screens-games-word-tiles-puzzle--enlarged-blank'];
  if (!story) throw new Error('Missing literal desktop puzzle regression');
  const scenario = visualScenarios(story).find(item => item.width === 1440 && item.theme === 'light');
  if (!scenario) throw new Error('Missing desktop light scenario');
  await verifyStoryScenario(page, story.id, scenario);
});
''';p.write_text(s)
for bug,summary,file in [
 ('sokoban-history-forgets-saved-completion','Solving the corner fixture then restarting clears the current solved notice but must retain its saved completion.','board-round-five.checks.ts'),
 ('word-tiles-puzzle-desktop-board-overflow','At 1440x844 the enlarged-blank puzzle initially places the fitted board bottom at 881.25px, below its rack and controls.','word-tiles-round-five.checks.ts')]:
 Path('libs/tools-harness-ts/goal/known-bugs/'+bug+'.json').write_text(json.dumps({'summary':summary,'regressionTest':'pkgs/ui-root-harness-ts/tests/storybook/'+file},indent=2)+'\n')
