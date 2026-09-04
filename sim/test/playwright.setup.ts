import { installPlaywrightUiTestRunner } from '@pkgs/ui-testing/runner/playwright';

process.env['PLAYWRIGHT_BASE_URL'] =
  process.env['PLAYWRIGHT_BASE_URL'] ?? 'http://127.0.0.1:5173';
process.env['SIM_MODE'] = 'max';

installPlaywrightUiTestRunner();
