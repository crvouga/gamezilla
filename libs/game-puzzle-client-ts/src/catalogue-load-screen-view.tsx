import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans } from '@lingui/solid/macro';
import { placeBehind } from '@pkgs/turn-game-client-ts/screen-places';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { ScreenBaseBreadcrumb } from '@pkgs/ui-root-client-ts/screen-base-types';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, type JSX, Match, Show, Switch } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type {
  CatalogueLoadCopy,
  CatalogueLoadJob,
} from './catalogue-load-client';
import { CatalogueLoadHubView } from './catalogue-load-hub-view';
import {
  CATALOGUE_LOAD_PLACES,
  type CatalogueLoadLink,
  type CatalogueLoadPlace,
  type CatalogueLoadStage,
} from './catalogue-load-places';
import { CatalogueLoadSourceView } from './catalogue-load-source-view';
import { CatalogueLoadStop } from './catalogue-load-stop';
import type {
  CatalogueLoadFrameView,
  CatalogueLoadStopKind,
  CatalogueSourceView,
} from './catalogue-load-view';

export type CatalogueLoadScreenViewProps = {
  readonly frame: CatalogueLoadFrameView;
  readonly copy: CatalogueLoadCopy;
  /** Where loading stands. */
  readonly stage: CatalogueLoadStage;
  /** The small screen this device shows within the stage. */
  readonly place: CatalogueLoadPlace;
  readonly onOpen: (place: CatalogueLoadPlace) => void;
  /** The device's line to the load's status. */
  readonly link: CatalogueLoadLink;
  /** Why the person may not load, in the `denied` stage. */
  readonly denial?: DenialView | undefined;
  /** The puzzles available to solvers; `null` until a load reported it. */
  readonly pool: number | null;
  /** The latest load; `null` when none has run or is known. */
  readonly job: CatalogueLoadJob | null;
  readonly source: CatalogueSourceView;
  readonly onSelectFile: (file: File | null) => void;
  readonly onSave: () => Promise<void>;
  readonly onRecheck: () => void;
  readonly onStart: () => Promise<void>;
  readonly onStop: () => Promise<void>;
};

/** The place's own name, when it is not the loader's hub. */
function placeTitle(props: CatalogueLoadScreenViewProps): JSX.Element {
  return props.place.screen === 'source' ? (
    props.copy.sourceName
  ) : (
    <Dynamic component={props.copy.title} />
  );
}

/**
 * The routed page's trail: its parent, then the loader; a place behind the
 * hub adds itself and makes the loader's crumb the way back to the hub.
 */
function routedTrail(
  props: CatalogueLoadScreenViewProps,
  frame: Extract<CatalogueLoadFrameView, { kind: 'routed' }>
): readonly ScreenBaseBreadcrumb[] {
  const title = <Dynamic component={props.copy.title} />;
  const behind = placeBehind(CATALOGUE_LOAD_PLACES, props.stage, props.place);
  return behind === null
    ? [frame.parent, { name: title }]
    : [
        frame.parent,
        { name: title, onClick: frame.onBack },
        { name: placeTitle(props) },
      ];
}

/** The loader in its host: a space's embedded screen, or its routed page. */
function CatalogueLoadFrame(
  props: CatalogueLoadScreenViewProps & { children: JSX.Element }
): JSX.Element {
  const routed = () => (props.frame.kind === 'routed' ? props.frame : null);
  return (
    <Show
      when={routed()}
      fallback={
        <EmbeddedScreen
          screenId="catalogue-load"
          title={placeTitle(props)}
          subtitle={
            props.place.screen === 'source' ? undefined : (
              <Dynamic component={props.copy.subtitle} />
            )
          }
        >
          {props.children}
        </EmbeddedScreen>
      }
    >
      {(frame) => (
        <ContentScreen
          screenId="catalogue-load"
          width="menu"
          breadcrumbs={routedTrail(props, frame())}
        >
          {props.children}
        </ContentScreen>
      )}
    </Show>
  );
}

/**
 * Loading a game's puzzle catalogue from a shared source file,
 * presentational. One shell (the connection notice and the confirmed stop)
 * around the place the stage shows: `status` says why the person may not
 * load, `load` is the hub (the pool, the source row, start or stop, and the
 * latest load) and `source` is where the shared file is checked, chosen,
 * uploaded and its upload stopped. `CatalogueLoadScreen` derives the stage
 * from the game's facts and keeps the place.
 */
export function CatalogueLoadScreenView(
  props: CatalogueLoadScreenViewProps
): JSX.Element {
  const [asked, setAsked] = createSignal<CatalogueLoadStopKind | null>(null);
  return (
    <CatalogueLoadFrame {...props}>
      <StackVertical
        gap="lg"
        testId="puzzle-load-content"
        dataSet={{ stage: props.stage, place: props.place.screen }}
      >
        <Show when={props.link === 'offline' && props.stage !== 'denied'}>
          <Notice dataSet={{ testid: 'puzzle-load-offline' }}>
            <Trans>
              You are offline. The last status is shown. Reconnect to check or
              save the {props.copy.sourceName}, start loading, or stop loading.
            </Trans>
          </Notice>
        </Show>
        <Switch>
          <Match when={props.place.screen === 'status'}>
            <Show when={props.denial}>
              {(denial) => (
                <DenialSurfaceView denial={denial()} variant="compact" />
              )}
            </Show>
          </Match>
          <Match when={props.place.screen === 'load'}>
            <CatalogueLoadHubView
              copy={props.copy}
              stage={props.stage}
              link={props.link}
              pool={props.pool}
              job={props.job}
              source={props.source}
              onOpenSource={() => props.onOpen({ screen: 'source' })}
              onStart={props.onStart}
              onAskStop={() => setAsked('loading')}
            />
          </Match>
          <Match when={props.place.screen === 'source'}>
            <CatalogueLoadSourceView
              copy={props.copy}
              link={props.link}
              source={props.source}
              onSelectFile={props.onSelectFile}
              onSave={props.onSave}
              onRecheck={props.onRecheck}
              onAskStop={() => setAsked('saving')}
            />
          </Match>
        </Switch>
      </StackVertical>
      <CatalogueLoadStop
        asked={asked()}
        onClose={() => setAsked(null)}
        uploading={props.stage === 'saving'}
        online={props.link !== 'offline'}
        jobStatus={props.job?.status ?? null}
        sourceName={props.copy.sourceName}
        onStop={props.onStop}
      />
    </CatalogueLoadFrame>
  );
}
