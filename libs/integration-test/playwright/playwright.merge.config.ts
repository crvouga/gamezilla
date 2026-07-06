import {
  qaPlaywrightPaths,
  resolveGamezillaRepoRoot,
} from '../src/qa-playwright-paths';

const repoRoot = resolveGamezillaRepoRoot(__dirname);
const { reportDir } = qaPlaywrightPaths(repoRoot);

/** Used by `playwright merge-reports --config` to emit the unified HTML report. */
export default {
  reporter: [['html', { open: 'never', outputFolder: reportDir }]],
};
