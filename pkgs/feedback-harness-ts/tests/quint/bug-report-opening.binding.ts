/**
 * `specs/feedback/bug-report-opening.qnt` against bug reporting as Alice
 * meets it on her phone: what is open, its description and its screenshots
 * are read off the bug report, shake to report off its setting, and what the
 * phone allows off the phone. A closed bug report shows nothing, so its
 * draft is read as bug reporting keeps it on the device.
 */

import type { FeedbackReportingWorld } from '@pkgs/feedback-harness-ts/feedback';
import {
  addPicture,
  allowShakeToReport,
  chooseToReport,
  closeBugReport,
  describeBug,
  deviceTakesNoScreenshot,
  moveKeyboardThroughBugReport,
  phoneAsksBeforeShaking,
  readDescription,
  readDraft,
  readOpenBugReports,
  readPhoneAllows,
  readScreenshots,
  readShakeToReport,
  refuseShakeToReport,
  removeScreenshot,
  reopenApp,
  shakePhone,
  turnOffShakeToReport,
  turnOnShakeToReport,
  waitMinutes,
} from '@pkgs/feedback-harness-ts/feedback';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';

type World = Run<FeedbackReportingWorld>;

bindQuintModel<World>({
  model: 'bug-report-opening',
  traces: 24,
  maxSteps: 12,
  timeoutMs: 120_000,
  actions: {
    init: async (w, picks) => {
      if (picks['takesScreenshots'] === false)
        await w.apply(deviceTakesNoScreenshot);
      if (picks['asksFirst'] === true) await w.apply(phoneAsksBeforeShaking);
    },
    chooseToReport: (w) => w.apply(chooseToReport),
    // A shake is its own shake only a while after the last one.
    shakePhone: async (w) => {
      await w.apply(waitMinutes, 1);
      await w.apply(shakePhone);
    },
    closeBugReport: (w) => w.apply(closeBugReport),
    describeBug: (w) => w.apply(describeBug, 'The board froze after a move'),
    addPicture: (w, picks) =>
      w.apply(addPicture, {
        contentType:
          picks['kind'] === 'picture' ? 'image/png' : 'application/pdf',
        megabytes: picks['megabytes'] as number,
      }),
    removeScreenshot: (w) => w.apply(removeScreenshot),
    moveKeyboardThrough: (w) => w.apply(moveKeyboardThroughBugReport),
    turnOffShakeToReport: (w) => w.apply(turnOffShakeToReport),
    turnOnShakeToReport: (w) => w.apply(turnOnShakeToReport),
    allowShakeToReport: (w) => w.apply(allowShakeToReport),
    refuseShakeToReport: (w) => w.apply(refuseShakeToReport),
    reopenApp: (w) => w.apply(reopenApp),
  },
  observe: async (w) => {
    const openBugReports = await w.read(readOpenBugReports);
    const closed =
      openBugReports === 0 ? await w.read(readDraft) : { open: true as const };
    return {
      openBugReports,
      described:
        closed && 'open' in closed
          ? (await w.read(readDescription)) !== ''
          : (closed?.described ?? false),
      screenshots:
        closed && 'open' in closed
          ? await w.read(readScreenshots)
          : (closed?.screenshots ?? 0),
      shakeToReport: await w.read(readShakeToReport),
      phoneAllows: await w.read(readPhoneAllows),
    };
  },
});
