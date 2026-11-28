/** @jsxImportSource @solidjs/web */
import { setupI18n } from '@lingui/core';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import { I18nProvider } from '@pkgs/lingui-solid-client-ts/runtime';
import {
  OVERLAY_PORTAL_Z_INDEX,
  OverlayPortalProvider,
} from '@pkgs/ui-root-client-ts/overlay-portal';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from '@solidjs/web';
import { createMemo, omit, Show } from 'solid-js';
import {
  BugReportFormView,
  type BugReportFormViewProps,
} from './bug-report-form';
import type { ContextMenuControl } from './context-menu';
import { BugReportContextMenu } from './context-menu-view';
import type { BugReportController } from './controller';
import { useBugReportState } from './use-bug-reports';

export type BugReportSurfaceViewProps = BugReportFormViewProps & {
  /** Whether the bug report is open. */
  visible: boolean;
};

/**
 * The bug report as a person meets it: a sheet on a phone and a dialog on a
 * wider screen, titled and closable, holding `BugReportFormView`.
 */
export function BugReportSurfaceView(props: BugReportSurfaceViewProps) {
  const form = omit(props, 'visible');
  return (
    <ResponsiveSurface
      visible={props.visible}
      onClose={form.onClose}
      title="Report a bug"
      size="medium"
      stackId="bug-report"
      dataSet={{ testid: 'bug-report' }}
      closeDataSet={{ testid: 'bug-report-close' }}
    >
      <BugReportFormView {...form} />
    </ResponsiveSurface>
  );
}

function BugReportSurface(props: { controller: BugReportController }) {
  const state = useBugReportState(() => props.controller);
  // Opening is told apart from every other change: a surface told again that
  // it is open takes the focus back from the field a person is writing in.
  const open = createMemo(() => state().open);
  return (
    <BugReportSurfaceView
      visible={open()}
      description={state().description}
      screenshots={state().screenshots}
      adding={state().adding}
      phase={state().phase}
      notice={state().notice}
      waiting={state().waiting}
      onDescribe={props.controller.describe}
      onAddPicture={(picture) => void props.controller.addPicture(picture)}
      onRemoveScreenshot={props.controller.removeScreenshot}
      onSend={() => void props.controller.send()}
      onDiscard={() => void props.controller.discard()}
      onClose={props.controller.close}
    />
  );
}

/**
 * Renders the bug report into its own host, with its own words and
 * overlays, so it shows whatever has become of the app beside it.
 */
export function renderBugReportSurface(
  host: HTMLElement,
  controller: BugReportController,
  ports: {
    readonly clock: Clock;
    readonly timers: Timers;
    /** The app's right-click menu, where the device has a mouse to use it. */
    readonly contextMenu?: ContextMenuControl | undefined;
  }
): () => void {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  host.setAttribute('data-feedback-root', '');
  host.className = 'box fixed inset-0 pointer-events-none';
  host.style.setProperty('z-index', String(OVERLAY_PORTAL_Z_INDEX));
  return render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={ports.clock} timers={ports.timers}>
          <ThemeProvider transparent>
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <BugReportSurface controller={controller} />
                <Show when={ports.contextMenu}>
                  {(control) => <BugReportContextMenu control={control()} />}
                </Show>
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    host
  );
}
